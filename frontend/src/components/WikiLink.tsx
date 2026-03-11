import type { ReactNode } from 'react';

const ExternalIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className="h-4 w-4"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-4.5h6m0 0v6m0-6L9.75 14.25"
    />
  </svg>
);

/**
 * External link that opens a Bulbapedia wiki page in a new tab.
 * Renders an icon by default, or wraps children if provided.
 */
export default function WikiLink({
  href,
  label,
  children,
}: {
  href: string;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label ?? 'View on Bulbapedia'}
      className="inline-flex items-center text-gray-400 transition-colors hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
    >
      {children ?? ExternalIcon}
    </a>
  );
}
