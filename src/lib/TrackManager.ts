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
    { id: 'builtin-1', name: 'Da Capo', artist: 'HOYO-MiX', url: './Da Capo - HOYO-MiX.mp3', isCustom: false },
    { id: 'builtin-2', name: 'Had I Not Seen the Sun', artist: 'HOYO-MiX', url: './Had I Not Seen the Sun.mp3', isCustom: false },
    { id: 'builtin-3', name: 'If I can Stop One Heart From Breaking', artist: 'HOYO-MiX', url: './If I can Stop One Heart From Breaking.mp3', isCustom: false },
    { id: 'builtin-4', name: 'Hope Is the Thing With Feathers', artist: 'HOYO-MiX', url: './Hope Is the Thing With Feathers.mp3', isCustom: false },
    { id: 'builtin-5', name: 'Sway to My Beat in Cosmos', artist: 'HOYO-MiX', url: './Sway to My Beat in Cosmos.mp3', isCustom: false },
    { id: 'builtin-6', name: 'prettyjohn1', artist: 'prettyjohn1', url: './prettyjohn1.mp3', isCustom: false },
];

const STORE_KEY = 'custom-tracks-v2';

export class TrackManager {
    private static customTracks: Track[] = [];
    private static isLoaded = false;

    static async init(): Promise<void> {
        if (this.isLoaded) return;
        try {
            const storedV2 = await get(STORE_KEY);
            if (storedV2 && Array.isArray(storedV2)) {
                this.customTracks = storedV2.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    file: item.file,
                    isCustom: true,
                    artist: item.artist,
                    coverArt: item.coverArt
                }));
            } else {
                // Fallback to v1 for backward compatibility
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
            console.error("Failed to load custom tracks from IndexedDB", e);
        }
        this.isLoaded = true;
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

        const track: Track = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
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
