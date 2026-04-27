# Trainer Assist

A mobile-first Pokémon toolbox for trainers. Browse the full Pokédex, explore type matchups, search moves, and build teams with coverage analysis — all in English, Japanese, or Chinese, with light and dark themes.

**🌐 Live website: [pokemon.y33.ch](http://pokemon.y33.ch/)**

## Features

| | |
|---|---|
| 🔍 **Pokémon Browser** | Search and filter 1200+ Pokémon (including regional variants and battle forms) by type, with paginated grid view and sprites. |
| 📖 **Pokémon Detail** | Base stats, abilities (with descriptions and hidden-ability indicators), level-up moves, and species info. |
| 🎯 **Type Explorer** | Pick 1–2 types to see defensive and offensive effectiveness, plus all Pokémon matching that typing. |
| ⚔️ **Move Search** | Sortable, filterable table of every move by name, type, and damage class. |
| 🛡️ **Team Builder** | Build 6-slot teams with a search picker and instantly see shared weaknesses, resistances, and coverage gaps. |
| 🌏 **i18n** | Full UI, Pokémon names, types, moves, and abilities in English, Japanese, and Simplified Chinese — search supports pinyin. |
| 🌗 **Theme** | Light, dark, and system-auto themes. |
| 📱 **Mobile-first** | Responsive layout with a bottom navigation bar on small screens. |

## Search Highlights

- Search Pokémon by English/Japanese/Chinese names, **pinyin** (e.g. `pikaqiu` or `pkq`), or custom **nicknames**.
- Wiki links adapt to your language: Bulbapedia (EN), 52Poke (ZH), or ポケモンWiki (JA).

## Try It Locally

```bash
make up        # Start everything in Docker
make seed      # Populate the Pokédex (first time only)
# Open http://localhost:3000
```

For local development, contribution guidelines, architecture details, and the full tech stack, see [`CLAUDE.md`](./CLAUDE.md).

## License

MIT
