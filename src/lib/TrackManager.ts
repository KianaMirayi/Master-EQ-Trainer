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
    { id: 'builtin-1', name: 'Da Capo - HOYO-MiX', url: '/Da Capo - HOYO-MiX.mp3', isCustom: false },
    { id: 'builtin-2', name: 'Had I Not Seen the Sun', url: '/Had I Not Seen the Sun.mp3', isCustom: false },
    { id: 'builtin-3', name: 'If I can Stop One Heart From Breaking', url: '/If I can Stop One Heart From Breaking.mp3', isCustom: false },


];

export class TrackManager {
    private static customTracks: Track[] = [];

    static getBuiltInTracks(): Track[] {
        return BUILT_IN_TRACKS;
    }

    static getCustomTracks(): Track[] {
        return this.customTracks;
    }

    static getAllTracks(): Track[] {
        return [...this.getBuiltInTracks(), ...this.getCustomTracks()];
    }

    static addCustomTrack(file: File): Track {
        const track: Track = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            file: file,
            isCustom: true
        };
        this.customTracks.push(track);
        return track;
    }

    static getRandomTrack(): Track | null {
        const all = this.getAllTracks();
        if (all.length === 0) return null;
        return all[Math.floor(Math.random() * all.length)];
    }
}
