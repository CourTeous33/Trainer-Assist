export default function Footer() {
  return (
    <footer className="pb-20 pt-8 flex justify-center text-xs text-gray-400 dark:text-gray-500">
      <div className="flex items-center gap-3">
        <span>&copy; {new Date().getFullYear()} y33.ch</span>
        <span>&middot;</span>
        <span>MIT License</span>
        <span>&middot;</span>
        <a
          href="https://github.com/CourTeous33/Trainer-Assist"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
