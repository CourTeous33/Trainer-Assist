interface TypeIconProps {
  typeName: string;
  className?: string;
}

export default function TypeIcon({
  typeName,
  className = "h-4 w-4",
}: TypeIconProps) {
  const key = typeName.toLowerCase();

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/types/${key}.png`}
      alt={`${typeName} type`}
      className={className}
      draggable={false}
    />
  );
}
