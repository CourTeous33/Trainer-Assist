interface TypeIconProps {
  typeName: string;
  className?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  normal: (
    // Star shape
    <polygon points="12,2 14.9,8.6 22,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 2,9.3 9.1,8.6" />
  ),
  fire: (
    // Flame
    <path d="M12,2C12,2 7,9 7,13.5C7,16.5 8,18 9.5,19.5C8.5,17.5 9,15 12,12C12,15 13,17 13,19C14.5,18 17,16.5 17,13.5C17,9 12,2 12,2Z" />
  ),
  water: (
    // Water droplet
    <path d="M12,2C12,2 6,10 6,15C6,18.3 8.7,21 12,21C15.3,21 18,18.3 18,15C18,10 12,2 12,2Z" />
  ),
  electric: (
    // Lightning bolt
    <polygon points="13,2 6,13 11,13 10,22 18,10 13,10" />
  ),
  grass: (
    // Leaf
    <path d="M17,3C17,3 12,5 8,9C5,12 4,16 4,20L6,20C6,16 7.5,13 10,10.5C12,8.5 15,7 17,6.5C16.5,9.5 15,12 13,14C11.5,15.5 9,17 7,17.5L7,19.5C10,19 13,17 15,15C18,12 20,7 20,3L17,3Z" />
  ),
  ice: (
    // Snowflake (hexagonal)
    <path d="M12,2V22M12,2L9,5M12,2L15,5M12,22L9,19M12,22L15,19M3.3,7L20.7,17M3.3,7L4.3,10.5M3.3,7L6.8,6M20.7,17L19.7,13.5M20.7,17L17.2,18M20.7,7L3.3,17M20.7,7L19.7,10.5M20.7,7L17.2,6M3.3,17L4.3,13.5M3.3,17L6.8,18" />
  ),
  fighting: (
    // Fist
    <path d="M7,12L7,7C7,5.9 7.9,5 9,5C10.1,5 11,5.9 11,7V10M11,10V5C11,3.9 11.9,3 13,3C14.1,3 15,3.9 15,5V10M15,10V6C15,4.9 15.9,4 17,4C18.1,4 19,4.9 19,6V14C19,18 16,21 12,21C8,21 5,18 5,15L7,12Z" />
  ),
  poison: (
    // Poison drop with bubbles
    <path d="M12,2C12,2 7,9 7,13C7,15.8 9.2,18 12,18C14.8,18 17,15.8 17,13C17,9 12,2 12,2ZM10,12.5A1.5,1.5 0 1,1 10,15.5A1.5,1.5 0 1,1 10,12.5ZM14,11A1,1 0 1,1 14,13A1,1 0 1,1 14,11ZM9,19L8,22M15,19L16,22" />
  ),
  ground: (
    // Mountain
    <path d="M2,20L8,8L11,14L15,6L22,20Z" />
  ),
  flying: (
    // Wing
    <path d="M3,17C3,17 5,15 7,14C9,13 12,13 12,13C12,13 8,11 5,10C7,8 10,6 14,6C18,6 21,9 21,9C21,9 19,7 16,7C14,7 12,8 12,8C12,8 16,9 18,11C15,12 12,13 12,13C12,13 16,14 19,16C16,17 12,18 8,18C5,18 3,17 3,17Z" />
  ),
  psychic: (
    // Eye
    <path d="M2,12C2,12 6,6 12,6C18,6 22,12 22,12C22,12 18,18 12,18C6,18 2,12 2,12Z">
    </path>
  ),
  bug: (
    // Beetle/ladybug
    <path d="M12,4A6,8 0 0,1 18,12A6,8 0 0,1 12,20A6,8 0 0,1 6,12A6,8 0 0,1 12,4ZM12,4V20M6.5,10L17.5,10M6.5,14L17.5,14M9,3L7,1M15,3L17,1" />
  ),
  rock: (
    // Diamond/gem shape
    <polygon points="12,2 19,8 17,21 7,21 5,8" />
  ),
  ghost: (
    // Ghost silhouette
    <path d="M12,3C8,3 5,6 5,10V20L7.5,18L10,20L12,18L14,20L16.5,18L19,20V10C19,6 16,3 12,3ZM9,11A1.5,1.5 0 1,1 9,14A1.5,1.5 0 1,1 9,11ZM15,11A1.5,1.5 0 1,1 15,14A1.5,1.5 0 1,1 15,11Z" />
  ),
  dragon: (
    // Dragon fang/tooth
    <path d="M8,2L12,22L16,2C16,2 15,8 14,11C13,14 12,16 12,16C12,16 11,14 10,11C9,8 8,2 8,2ZM6,6L10,14M18,6L14,14" />
  ),
  dark: (
    // Crescent moon
    <path d="M16,4C10,4 5,8 5,13.5C5,18.5 9,22 14,22C16,22 17.5,21.5 19,20.5C17,21 15.5,20.5 14,19.5C11,17.5 10,14 11,11C12,8 14.5,5.5 18,5C17.5,4.5 16.5,4 16,4Z" />
  ),
  steel: (
    // Gear/cog
    <path d="M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8ZM10.5,2L10,5L8,5.5L5.5,3.5L3.5,5.5L5.5,8L5,10L2,10.5V13.5L5,14L5.5,16L3.5,18.5L5.5,20.5L8,18.5L10,19L10.5,22H13.5L14,19L16,18.5L18.5,20.5L20.5,18.5L18.5,16L19,14L22,13.5V10.5L19,10L18.5,8L20.5,5.5L18.5,3.5L16,5.5L14,5L13.5,2Z" />
  ),
  fairy: (
    // Sparkle star with curves
    <path d="M12,1L13.5,8.5L20,6L15,11L23,12L15,13L20,18L13.5,15.5L12,23L10.5,15.5L4,18L9,13L1,12L9,11L4,6L10.5,8.5Z" />
  ),
};

export default function TypeIcon({
  typeName,
  className = "h-4 w-4",
}: TypeIconProps) {
  const key = typeName.toLowerCase();
  const icon = typeIcons[key];

  // Add an inner element for the psychic eye's pupil
  if (key === "psychic") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        className={className}
        aria-label={`${typeName} type`}
      >
        <path d="M2,12C2,12 6,6 12,6C18,6 22,12 22,12C22,12 18,18 12,18C6,18 2,12 2,12Z" fill="none" strokeWidth="2" />
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  // Ice type uses strokes only
  if (key === "ice") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={className}
        aria-label={`${typeName} type`}
      >
        {icon}
      </svg>
    );
  }

  // Bug type uses strokes
  if (key === "bug") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={className}
        aria-label={`${typeName} type`}
      >
        {icon}
      </svg>
    );
  }

  if (!icon) {
    // Default: circle for unknown types
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-label={`${typeName} type`}
      >
        <circle cx="12" cy="12" r="10" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label={`${typeName} type`}
    >
      {icon}
    </svg>
  );
}
