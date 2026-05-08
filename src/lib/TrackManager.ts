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
    { id: 'builtin-2', name: 'End of Summer-The 126ers', artist: 'The 126ers', url: '/built-in/End of Summer.mp3', isCustom: false },
    { id: 'builtin-3', name: 'Funk Power', artist: 'Aleksandr', url: '/built-in/Funk Power.mp3', isCustom: false },
    { id: 'builtin-4', name: 'Moving On', artist: 'Wayne Jones', url: '/built-in/Moving On.mp3', isCustom: false },
    { id: 'builtin-5', name: 'My Sad Old Heart', artist: 'The 126ers', url: '/built-in/My Sad Old Heart.mp3', isCustom: false },
    { id: 'builtin-6', name: 'On My Way Home', artist: 'The 126ers', url: '/built-in/On My Way Home.mp3', isCustom: false },
    { id: 'builtin-7', name: 'Hold On', artist: 'Prismo', url: '/built-in/Prismo.mp3', isCustom: false },
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

        // Load custom tracks first thing to ensure UI responsiveness
        const loadCustomPromise = (async () => {
            try {
                const storedV2 = await get(STORE_KEY);
                if (storedV2 && Array.isArray(storedV2)) {
                    console.log(`TrackManager: Found ${storedV2.length} custom tracks in V2 storage`);
                    this.customTracks = storedV2.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        file: item.file,
                        isCustom: true,
                        artist: item.artist,
                        coverArt: item.coverArt
                    }));
                } else {
                    const storedV1 = await get('custom-tracks-v1');
                    if (storedV1 && Array.isArray(storedV1)) {
                         console.log(`TrackManager: Found ${storedV1.length} custom tracks in V1 storage`);
                         this.customTracks = storedV1.map((item: any) => ({
                            id: item.id,
                            name: item.name,
                            file: item.file,
                            isCustom: true
                        }));
                    }
                }
            } catch (e) {
                console.error("TrackManager: Error loading custom tracks from IndexedDB", e);
            }
        })();

        // Metadata loading for built-in tracks (don't block the custom track load)
        const loadBuiltInMetadata = (async () => {
            try {
                const builtInPromises = BUILT_IN_TRACKS.map(t => new Promise<void>((resolve) => {
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
                            if (coverArt) t.coverArt = coverArt;
                            resolve();
                        },
                        onError: function(error) {
                            console.log('TrackManager: Built-in tag error:', t.name, error);
                            resolve();
                        }
                    });
                }));
                await Promise.all(builtInPromises);
            } catch (e) {
                console.error("TrackManager: Built-in metadata failed", e);
            }
        })();

        await Promise.all([loadCustomPromise, loadBuiltInMetadata]);
        
        this.isLoaded = true;
        console.log("TrackManager: Initialization complete. Total custom tracks:", this.customTracks.length);
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
                    resolve({
                        title: tag.tags.title,
                        artist: tag.tags.artist,
                        coverArt
                    });
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
