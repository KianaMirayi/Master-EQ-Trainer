import { get, set, del, entries } from 'idb-keyval';

export interface Track {
    id: string;
    name: string;
    url?: string;
    file?: File;
    isCustom: boolean;
}

export const BUILT_IN_TRACKS: Track[] = [
    //{ id: 'builtin-1', name: 'Demo Track 1', url: '/demo1.mp3', isCustom: false },
    //{ id: 'builtin-2', name: 'Demo Track 2', url: '/demo2.mp3', isCustom: false },
    { id: 'builtin-1', name: 'Da Capo', url: '/Da Capo - HOYO-MiX.mp3', isCustom: false },
    { id: 'builtin-2', name: 'Had I Not Seen the Sun', url: '/Had I Not Seen the Sun.mp3', isCustom: false },
    { id: 'builtin-3', name: 'If I can Stop One Heart From Breaking', url: '/If I can Stop One Heart From Breaking.mp3', isCustom: false },
    { id: 'builtin-4', name: 'Hope Is the Thing With Feathers', url: '/Hope Is the Thing With Feathers.mp3', isCustom: false },
    { id: 'builtin-5', name: 'Sway to My Beat in Cosmos', url: '/Sway to My Beat in Cosmos.mp3', isCustom: false },


];

const STORE_KEY = 'custom-tracks-v1';

export class TrackManager {
    private static customTracks: Track[] = [];
    private static isLoaded = false;

    static async init(): Promise<void> {
        if (this.isLoaded) return;
        try {
            const stored = await get(STORE_KEY);
            if (stored && Array.isArray(stored)) {
                this.customTracks = stored.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    file: item.file,
                    isCustom: true
                }));
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
        const track: Track = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name.replace(/\.[^/.]+$/, ""),
            file: file, // File objects are clonable and can be stored in IndexedDB
            isCustom: true
        };
        this.customTracks.push(track);
        
        try {
            await set(STORE_KEY, this.customTracks.map(t => ({
                id: t.id,
                name: t.name,
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
