import { get, set, del, entries } from 'idb-keyval';
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export interface Track {
    id: string;
    name: string;
    url?: string;
    file?: File;
    isCustom: boolean;
    artist?: string;
    coverArt?: string; // Data URL for the cover art
}

export const BUILT_IN_TRACKS: Track[] = [
    { id: 'builtin-1', name: 'Emotional Soul', artist: 'Dvir Silverstone', url: '/built-in/Emotional Soul.mp3', isCustom: false },
    { id: 'builtin-3', name: 'Funk Power', artist: 'Aleksandr', url: '/built-in/Funk Power.mp3', isCustom: false },
    { id: 'builtin-7', name: 'Hold On', artist: 'Prismo', url: '/built-in/Hold On.mp3', isCustom: false },
    { id: 'builtin-8', name: 'Sad', artist: 'Nikita Kondrashev', url: '/built-in/Sad.mp3', isCustom: false },
    { id: 'builtin-9', name: 'Sock Hop', artist: 'Kevin MacLeod', url: '/built-in/Sock Hop.mp3', isCustom: false },
    { id: 'builtin-10', name: 'Vacation', artist: 'Aleksandr', url: '/built-in/Vacation.mp3', isCustom: false },
];

const STORE_KEY = 'custom-tracks-v2';

export class TrackManager {
    private static customTracks: Track[] = [];
    private static isLoaded = false;

    static async init(): Promise<void> {
        if (this.isLoaded) return;
        
        console.log("TrackManager: Initializing storage...");

        // 1. Load built-in tracks metadata in background (won't block UI)
        // These are static and don't need to be saved back to storage
        this.loadBuiltInMetadata().then(() => {
            console.log("TrackManager: Built-in metadata loaded.");
        });

        // 2. Load custom tracks from IndexedDB
        try {
            const storedV2 = await get(STORE_KEY);
            if (storedV2 && Array.isArray(storedV2)) {
                let needsMigration = false;
                let validTracks: Track[] = [];

                for (const item of storedV2) {
                    // Check if file still exists (blobs can be cleared by browser cleanup)
                    if (!item.file || !(item.file instanceof Blob)) {
                        console.warn(`TrackManager: Custom track ${item.name} lost its audio file, removing...`);
                        needsMigration = true;
                        continue;
                    }

                    let coverArt = item.coverArt;
                    /**
                     * COMPRESSION LOGIC EXPLANATION:
                     * Image data URLs (Base64) can be huge (several MBs). 
                     * Storing many of these in IndexedDB makes the app extremely slow to start.
                     * We resize them to a small thumbnail (120x120) which is plenty for the UI.
                     * This ONLY affects the cover image display, it NEVER touches the audio file.
                     */
                    if (coverArt && coverArt.length > 130000) {
                        console.log(`TrackManager: Found large cover art for ${item.name}, resizing to optimize storage...`);
                        coverArt = await TrackManager.resizeImage(coverArt);
                        needsMigration = true;
                    }

                    validTracks.push({
                        id: item.id,
                        name: item.name,
                        file: item.file,
                        isCustom: true,
                        artist: item.artist,
                        coverArt: coverArt
                    });
                }

                this.customTracks = validTracks;

                if (needsMigration) {
                    console.log("TrackManager: Saving cleaned/migrated tracks back to storage");
                    await set(STORE_KEY, this.customTracks.map(t => ({
                        id: t.id,
                        name: t.name,
                        artist: t.artist,
                        coverArt: t.coverArt,
                        file: t.file
                    })));
                }
            } else {
                const storedV1 = await get('custom-tracks-v1');
                if (storedV1 && Array.isArray(storedV1)) {
                     this.customTracks = storedV1.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        file: item.file,
                        isCustom: true
                    }));
                }
            }
        } catch (e) {
            console.error("TrackManager: Error loading custom tracks", e);
        }

        this.isLoaded = true;
        console.log("TrackManager: Initialization complete.");
    }

    static async loadBuiltInMetadata(): Promise<void> {
        try {
            const promises = BUILT_IN_TRACKS.map(t => new Promise<void>((resolve) => {
                if (!t.url) return resolve();
                const absoluteUrl = new URL(t.url, window.location.origin).href;
                jsmediatags.read(absoluteUrl, {
                    onSuccess: function(tag) {
                        let coverArt: string | undefined;
                        const picture = tag.tags.picture;
                        if (picture) {
                            let base64String = "";
                            for (let i = 0; i < picture.data.length; i++) {
                                base64String += String.fromCharCode(picture.data[i]);
                            }
                            coverArt = `data:${picture.format};base64,${window.btoa(base64String)}`;
                        }
                        if (tag.tags.title) t.name = tag.tags.title;
                        if (tag.tags.artist) t.artist = tag.tags.artist;
                        if (coverArt) {
                            TrackManager.resizeImage(coverArt).then(resized => {
                                t.coverArt = resized;
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    },
                    onError: function(error) {
                        // Silent fail for built-in tags to avoid console noise if files are missing
                        resolve();
                    }
                });
            }));
            await Promise.all(promises);
        } catch (e) {
            console.warn("TrackManager: Failed to fetch built-in metadata", e);
        }
    }

    static async resizeImage(dataUrl: string, maxWidth = 120, maxHeight = 120): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => resolve(dataUrl);
            img.src = dataUrl;
        });
    }

    static getBuiltInTracks(): Track[] {
        return BUILT_IN_TRACKS;
    }

    static getCustomTracks(): Track[] {
        return this.customTracks;
    }

    static getAllTracks(): Track[] {
        return [...this.getBuiltInTracks(), ...this.getCustomTracks()];
    }

    static async addCustomTrack(file: File): Promise<Track> {
        const metadata = await new Promise<{title?: string, artist?: string, coverArt?: string}>((resolve) => {
            jsmediatags.read(file, {
                onSuccess: function(tag) {
                    let coverArt: string | undefined;
                    const picture = tag.tags.picture;
                    if (picture) {
                        let base64String = "";
                        for (let i = 0; i < picture.data.length; i++) {
                            base64String += String.fromCharCode(picture.data[i]);
                        }
                        coverArt = `data:${picture.format};base64,${window.btoa(base64String)}`;
                    }
                    if (coverArt) {
                        TrackManager.resizeImage(coverArt).then(resized => {
                             resolve({
                                title: tag.tags.title,
                                artist: tag.tags.artist,
                                coverArt: resized
                            });
                        });
                    } else {
                        resolve({
                            title: tag.tags.title,
                            artist: tag.tags.artist
                        });
                    }
                },
                onError: function(error) {
                    console.log('Error reading tags for', file.name, error.type, error.info);
                    resolve({});
                }
            });
        });

        const trackName = metadata.title || file.name.replace(/\.[^/.]+$/, "");
        
        // Prevent duplicates
        const existingTrack = this.customTracks.find(t => 
            (t.file && t.file.name === file.name && t.file.size === file.size) || 
            (t.name === trackName && t.artist === metadata.artist && t.artist !== undefined)
        );

        if (existingTrack) {
            return existingTrack;
        }

        const track: Track = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: trackName,
            artist: metadata.artist,
            coverArt: metadata.coverArt,
            file: file,
            isCustom: true
        };
        this.customTracks.push(track);
        
        try {
            await set(STORE_KEY, this.customTracks.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artist,
                coverArt: t.coverArt,
                file: t.file
            })));
        } catch (e) {
             console.error("Failed to save custom track to IndexedDB", e);
        }

        return track;
    }

    static async deleteCustomTrack(id: string): Promise<void> {
        this.customTracks = this.customTracks.filter(t => t.id !== id);
        try {
            await set(STORE_KEY, this.customTracks.map(t => ({
                id: t.id,
                name: t.name,
                artist: t.artist,
                coverArt: t.coverArt,
                file: t.file
            })));
        } catch (e) {
             console.error("Failed to delete custom track from IndexedDB", e);
        }
    }

    static getRandomTrack(pool: 'all' | 'builtin' | 'custom' = 'all'): Track | null {
        let list: Track[] = [];
        if (pool === 'all') list = this.getAllTracks();
        else if (pool === 'builtin') list = this.getBuiltInTracks();
        else if (pool === 'custom') list = this.getCustomTracks();
        
        if (list.length === 0) return null;
        return list[Math.floor(Math.random() * list.length)];
    }
}
