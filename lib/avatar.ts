export function getNameInitials(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return "??";

    const parts = trimmedName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function hashString(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
}

function seededRandom(seed: number) {
    let nextSeed = seed;

    return function random() {
        nextSeed += 0x6d2b79f5;
        let value = nextSeed;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

export function getGradientFromUserId(userId?: string | null) {
    const normalizedUserId = (userId ?? "").trim();

    if (!normalizedUserId) {
        return "linear-gradient(135deg, hsl(220 14% 65%), hsl(220 14% 45%))";
    }

    const random = seededRandom(hashString(normalizedUserId));
    const angle = Math.floor(random() * 360);
    const baseHue = Math.floor(random() * 360);
    const hueA = baseHue;
    const hueB = (baseHue + 70 + Math.floor(random() * 60)) % 360;
    const hueC = (baseHue + 170 + Math.floor(random() * 60)) % 360;
    const saturationA = 72 + Math.floor(random() * 20);
    const saturationB = 72 + Math.floor(random() * 20);
    const saturationC = 72 + Math.floor(random() * 20);

    return `linear-gradient(${angle}deg, hsl(${hueA} ${saturationA}% 58%) 0%, hsl(${hueB} ${saturationB}% 50%) 50%, hsl(${hueC} ${saturationC}% 44%) 100%)`;
}