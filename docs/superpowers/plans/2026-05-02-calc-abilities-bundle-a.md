# Calc Abilities — Bundle A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ability support to `/calc` for 36 abilities whose effects don't depend on weather (deferred to Bundle B). Includes backend plumbing to expose move flags on `MoveSummary`.

**Architecture:** New `Ability` data model with optional flat-field effects (mirrors `Item`). New per-side `abilityId: string | null` on `PokemonConfig`. Damage pipeline gains seven gated touchpoints — every new branch is `if (atkAbility?.X)` so default `null` ability preserves existing behavior bit-for-bit. Move flags (`contact`/`punch`/`bite`/`pulse`/`sound`/`slicing`/`recoil`) ship on `MoveSummary` from a backend transform extension.

**Tech Stack:** Rust (Axum 0.8) + serde + csv crate for backend; TypeScript + React (Next.js 16) + Vitest for frontend.

**Spec:** `docs/superpowers/specs/2026-05-02-calc-abilities-bundle-a-design.md`

---

## File Structure

**Modify (backend):**
- `backend/crates/seed/src/fetch.rs` — add 3 new CSVs to fetch list
- `backend/crates/seed/src/parse.rs` — 3 new row structs + parsers in `parse_all`
- `backend/crates/seed/src/transform.rs` — attach `flags` to each `MoveSummary`
- `backend/crates/shared/src/models.rs` — add `flags: Vec<String>` field
- `backend/crates/seed/tests/parse_tests.rs` — fixture rows + parse assertions
- `backend/crates/seed/tests/transform_tests.rs` — flag attachment, recoil derivation, whitelist, dedup
- `backend/crates/shared/tests/models_tests.rs` — flag round-trip + default-empty

**Modify (frontend):**
- `frontend/src/lib/types.ts` — add `flags: string[]` on `MoveSummary`
- `frontend/src/lib/calc/types.ts` — add `abilityId: string | null` on `PokemonConfig`; export `MoveFlag` type
- `frontend/src/lib/calc/url.ts` — pack/unpack `ab` field
- `frontend/src/lib/calc/damage.ts` — integrate ability effects (the big one)
- `frontend/src/lib/calc/index.ts` — re-export from new `abilities.ts`
- `frontend/src/components/SidePanel-equivalent` (`frontend/src/app/calc/page.tsx`) — wire `AbilityDropdown` + `SET_*_ABILITY` actions
- `frontend/src/lib/i18n/translations.ts` — `calc.ability*` keys for en/ja/zh
- `frontend/src/lib/calc/__tests__/damage.test.ts` — extend
- `frontend/src/lib/calc/__tests__/url.test.ts` — extend
- `frontend/src/app/calc/__tests__/calc-page.test.tsx` — Pixilate smoke test

**Create (frontend):**
- `frontend/src/lib/calc/abilities.ts` — `Ability` interface + `ABILITIES` roster + `getAbility()`
- `frontend/src/lib/calc/move-flags.ts` — `hasMoveFlag(move, flag)` helper + `MoveFlag` type re-export
- `frontend/src/components/AbilityDropdown.tsx` — `<select>` mirroring `ItemDropdown`
- `frontend/src/lib/calc/__tests__/abilities.test.ts` — roster lookup + names
- `frontend/src/lib/calc/__tests__/move-flags.test.ts` — flag check
- `frontend/src/components/__tests__/AbilityDropdown.test.tsx`

---

# Phase 1 — Backend: move flags on `MoveSummary`

This phase has zero frontend impact. After it lands, `MoveSummary.flags` is populated in Redis and surfaced through the API. Frontend code added in Phase 2+ will consume it.

### Task 1: Add `flags` field to `MoveSummary` model

**Files:**
- Modify: `backend/crates/shared/src/models.rs:89-99`
- Test: `backend/crates/shared/tests/models_tests.rs`

- [ ] **Step 1: Write the failing test**

Append the following at the end of `backend/crates/shared/tests/models_tests.rs`:

```rust
#[test]
fn move_summary_flags_roundtrip() {
    use shared::models::{LocalizedNames, MoveSummary, TypeRef};
    let m = MoveSummary {
        id: 1,
        name: "ice-punch".to_string(),
        names: LocalizedNames { en: "Ice Punch".to_string(), ja: None, zh: None, zh_pinyin: None },
        type_ref: TypeRef { id: 15, name: "ice".to_string(), names: LocalizedNames { en: "Ice".to_string(), ja: None, zh: None, zh_pinyin: None } },
        power: Some(75),
        accuracy: Some(100),
        pp: Some(15),
        damage_class: "physical".to_string(),
        flags: vec!["contact".to_string(), "punch".to_string()],
    };
    let json = serde_json::to_string(&m).unwrap();
    let back: MoveSummary = serde_json::from_str(&json).unwrap();
    assert_eq!(back.flags, vec!["contact".to_string(), "punch".to_string()]);
}

#[test]
fn move_summary_default_empty_flags() {
    use shared::models::MoveSummary;
    // JSON without `flags` should deserialize to an empty vec via #[serde(default)].
    let json = r#"{
        "id": 33,
        "name": "tackle",
        "names": { "en": "Tackle" },
        "type_ref": { "id": 1, "name": "normal", "names": { "en": "Normal" } },
        "power": 40,
        "accuracy": 100,
        "pp": 35,
        "damage_class": "physical"
    }"#;
    let m: MoveSummary = serde_json::from_str(json).unwrap();
    assert!(m.flags.is_empty());
}
```

- [ ] **Step 2: Run test to verify it fails**

From `backend/`:
```
cargo test -p shared move_summary_flags
```
Expected: compile error (`MoveSummary` has no `flags` field).

- [ ] **Step 3: Add the field**

In `backend/crates/shared/src/models.rs`, edit the `MoveSummary` struct (around line 89):

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveSummary {
    pub id: i32,
    pub name: String,
    pub names: LocalizedNames,
    pub type_ref: TypeRef,
    pub power: Option<i32>,
    pub accuracy: Option<i32>,
    pub pp: Option<i32>,
    pub damage_class: String,
    #[serde(default)]
    pub flags: Vec<String>,
}
```

- [ ] **Step 4: Run tests to verify they pass**

From `backend/`:
```
cargo test -p shared move_summary
```
Expected: both new tests pass; existing tests still pass.

- [ ] **Step 5: Update `MoveSummary` construction in transform.rs (placeholder empty vec for now)**

In `backend/crates/seed/src/transform.rs:648`, the `MoveSummary { ... }` construction must add `flags: Vec::new()` so the seed crate compiles. We'll fill it in Task 4.

```rust
Some(MoveSummary {
    id: m.id,
    name,
    names,
    type_ref,
    power: m.power,
    accuracy: m.accuracy,
    pp: m.pp,
    damage_class: damage_class_name(m.damage_class_id),
    flags: Vec::new(), // populated in Task 4
})
```

- [ ] **Step 6: Verify the workspace builds**

From `backend/`:
```
cargo build
```
Expected: clean build.

- [ ] **Step 7: Commit**

```
git add backend/crates/shared/src/models.rs backend/crates/shared/tests/models_tests.rs backend/crates/seed/src/transform.rs
git commit -m "Add flags: Vec<String> field to MoveSummary"
```

### Task 2: Fetch the three new CSVs

**Files:**
- Modify: `backend/crates/seed/src/fetch.rs:11-30`

This task is data-only — no test needed (the unit under test is the constant list of CSV filenames; integration tests would hit live PokeAPI servers). The transform tests in Task 4 cover what matters end-to-end.

- [ ] **Step 1: Add the new CSV filenames**

In `backend/crates/seed/src/fetch.rs`, append three filenames to `CSV_FILES`:

```rust
const CSV_FILES: &[&str] = &[
    "pokemon.csv",
    "pokemon_types.csv",
    "pokemon_stats.csv",
    "pokemon_species.csv",
    "pokemon_species_names.csv",
    "types.csv",
    "type_names.csv",
    "type_efficacy.csv",
    "moves.csv",
    "move_names.csv",
    "pokemon_moves.csv",
    "stats.csv",
    "abilities.csv",
    "ability_names.csv",
    "pokemon_abilities.csv",
    "ability_flavor_text.csv",
    "pokemon_forms.csv",
    "pokemon_form_names.csv",
    "move_flag_map.csv",  // NEW
    "move_flags.csv",     // NEW
    "move_meta.csv",      // NEW
];
```

- [ ] **Step 2: Verify it compiles**

From `backend/`:
```
cargo build -p seed
```
Expected: clean build.

- [ ] **Step 3: Commit**

```
git add backend/crates/seed/src/fetch.rs
git commit -m "Fetch move_flag_map / move_flags / move_meta CSVs"
```

### Task 3: Add parse rows and parse_all wiring

**Files:**
- Modify: `backend/crates/seed/src/parse.rs:165-269`
- Test: `backend/crates/seed/tests/parse_tests.rs`

- [ ] **Step 1: Write the failing test**

Append to `backend/crates/seed/tests/parse_tests.rs` (you can add a new test function next to existing ones; if `make_csvs` is reused, also extend its returned map). Add at the bottom:

```rust
#[test]
fn parse_move_flags_and_meta() {
    let mut csvs = make_csvs();
    csvs.insert("move_flag_map.csv".into(),
        "move_id,move_flag_id\n\
         1,1\n\
         1,8\n\
         2,2\n".into());
    csvs.insert("move_flags.csv".into(),
        "id,identifier\n\
         1,contact\n\
         2,charge\n\
         8,punch\n".into());
    csvs.insert("move_meta.csv".into(),
        "move_id,meta_category_id,meta_ailment_id,min_hits,max_hits,min_turns,max_turns,drain,healing,crit_rate,ailment_chance,flinch_chance,stat_chance\n\
         1,0,0,,,,,0,0,0,0,0,0\n\
         2,0,0,,,,,-25,0,0,0,0,0\n".into());

    let parsed = parse_all(&csvs).expect("parse_all");
    assert_eq!(parsed.move_flag_map.len(), 3);
    assert_eq!(parsed.move_flags.len(), 3);
    assert!(parsed.move_meta.iter().any(|m| m.move_id == 2 && m.drain == -25));
}
```

You will also need `make_csvs` to provide *some* value for `move_flag_map.csv`/`move_flags.csv`/`move_meta.csv` so the existing parse tests don't break when the new fields become required. Edit `make_csvs` near the top of `backend/crates/seed/tests/parse_tests.rs` to insert empty headered CSVs by default:

```rust
csvs.insert("move_flag_map.csv".into(), "move_id,move_flag_id\n".into());
csvs.insert("move_flags.csv".into(), "id,identifier\n".into());
csvs.insert("move_meta.csv".into(),
    "move_id,meta_category_id,meta_ailment_id,min_hits,max_hits,min_turns,max_turns,drain,healing,crit_rate,ailment_chance,flinch_chance,stat_chance\n".into());
```

- [ ] **Step 2: Run test to verify it fails**

From `backend/`:
```
cargo test -p seed parse_move_flags_and_meta
```
Expected: compile error — `parsed.move_flag_map`, `move_flags`, `move_meta` don't exist on `ParsedData`.

- [ ] **Step 3: Add row structs**

In `backend/crates/seed/src/parse.rs`, append three new row structs near the existing `MoveRow`/`MoveNameRow` declarations (around line 100):

```rust
#[derive(Debug, Deserialize)]
pub struct MoveFlagMapRow {
    pub move_id: i32,
    pub move_flag_id: i32,
}

#[derive(Debug, Deserialize)]
pub struct MoveFlagRow {
    pub id: i32,
    pub identifier: String,
}

#[derive(Debug, Deserialize)]
pub struct MoveMetaRow {
    pub move_id: i32,
    #[serde(default)]
    pub meta_category_id: i32,
    #[serde(default)]
    pub meta_ailment_id: i32,
    pub min_hits: Option<i32>,
    pub max_hits: Option<i32>,
    pub min_turns: Option<i32>,
    pub max_turns: Option<i32>,
    #[serde(default)]
    pub drain: i32,
    #[serde(default)]
    pub healing: i32,
    #[serde(default)]
    pub crit_rate: i32,
    #[serde(default)]
    pub ailment_chance: i32,
    #[serde(default)]
    pub flinch_chance: i32,
    #[serde(default)]
    pub stat_chance: i32,
}
```

- [ ] **Step 4: Add fields to `ParsedData`**

In the same file, extend `ParsedData` (line 169-187):

```rust
pub struct ParsedData {
    pub pokemon: Vec<PokemonRow>,
    pub pokemon_types: Vec<PokemonTypeRow>,
    pub pokemon_stats: Vec<PokemonStatRow>,
    pub pokemon_species: Vec<PokemonSpeciesRow>,
    pub pokemon_species_names: Vec<PokemonSpeciesNameRow>,
    pub types: Vec<TypeRow>,
    pub type_names: Vec<TypeNameRow>,
    pub type_efficacy: Vec<TypeEfficacyRow>,
    pub moves: Vec<MoveRow>,
    pub move_names: Vec<MoveNameRow>,
    pub pokemon_moves: Vec<PokemonMoveRow>,
    pub abilities: Vec<AbilityRow>,
    pub ability_names: Vec<AbilityNameRow>,
    pub pokemon_abilities: Vec<PokemonAbilityRow>,
    pub ability_flavor_text: Vec<AbilityFlavorTextRow>,
    pub pokemon_forms: Vec<PokemonFormRow>,
    pub pokemon_form_names: Vec<PokemonFormNameRow>,
    pub move_flag_map: Vec<MoveFlagMapRow>,    // NEW
    pub move_flags: Vec<MoveFlagRow>,          // NEW
    pub move_meta: Vec<MoveMetaRow>,           // NEW
}
```

- [ ] **Step 5: Wire `parse_all`**

Append to the `parse_all` `Ok(ParsedData { ... })` block (just before its closing `})` around line 268):

```rust
        move_flag_map: parse_csv(get("move_flag_map.csv"), "move_flag_map.csv")
            .context("parsing move_flag_map.csv")?,
        move_flags: parse_csv(get("move_flags.csv"), "move_flags.csv")
            .context("parsing move_flags.csv")?,
        move_meta: parse_csv(get("move_meta.csv"), "move_meta.csv")
            .context("parsing move_meta.csv")?,
```

- [ ] **Step 6: Run tests to verify they pass**

From `backend/`:
```
cargo test -p seed parse_
```
Expected: new test plus existing parse tests pass.

- [ ] **Step 7: Commit**

```
git add backend/crates/seed/src/parse.rs backend/crates/seed/tests/parse_tests.rs
git commit -m "Parse move_flag_map / move_flags / move_meta CSVs"
```

### Task 4: Attach flags in transform.rs (whitelist + recoil derivation)

**Files:**
- Modify: `backend/crates/seed/src/transform.rs:625-660`
- Test: `backend/crates/seed/tests/transform_tests.rs`

- [ ] **Step 1: Write the failing tests**

Append to `backend/crates/seed/tests/transform_tests.rs`:

```rust
#[test]
fn move_flags_whitelisted_and_attached() {
    use seed::parse::{MoveFlagMapRow, MoveFlagRow, MoveMetaRow, MoveRow, MoveNameRow};
    use seed::transform::transform;
    let mut data = empty_parsed();  // helper that returns ParsedData with empty Vecs (already in test file or to be added)
    // Two moves, move 1 = ice punch (contact + punch), move 2 = body slam (contact only).
    data.moves = vec![
        MoveRow { id: 1, identifier: "ice-punch".into(), generation_id: 1, type_id: 15, power: Some(75), pp: Some(15), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
        MoveRow { id: 2, identifier: "body-slam".into(), generation_id: 1, type_id: 1, power: Some(85), pp: Some(15), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
    ];
    data.move_names = vec![
        MoveNameRow { move_id: 1, local_language_id: 9, name: "Ice Punch".into() },
        MoveNameRow { move_id: 2, local_language_id: 9, name: "Body Slam".into() },
    ];
    data.move_flag_map = vec![
        MoveFlagMapRow { move_id: 1, move_flag_id: 1 },   // contact
        MoveFlagMapRow { move_id: 1, move_flag_id: 8 },   // punch
        MoveFlagMapRow { move_id: 1, move_flag_id: 2 },   // charge — should be filtered out
        MoveFlagMapRow { move_id: 2, move_flag_id: 1 },   // contact
    ];
    data.move_flags = vec![
        MoveFlagRow { id: 1, identifier: "contact".into() },
        MoveFlagRow { id: 2, identifier: "charge".into() },
        MoveFlagRow { id: 8, identifier: "punch".into() },
    ];
    let out = transform(data).expect("transform");
    let ice_punch = out.move_summaries.iter().find(|m| m.id == 1).unwrap();
    let body_slam = out.move_summaries.iter().find(|m| m.id == 2).unwrap();
    // Whitelisted, sorted, and "charge" removed.
    assert_eq!(ice_punch.flags, vec!["contact".to_string(), "punch".to_string()]);
    assert_eq!(body_slam.flags, vec!["contact".to_string()]);
}

#[test]
fn move_flags_recoil_derived_from_negative_drain() {
    use seed::parse::{MoveMetaRow, MoveRow, MoveNameRow};
    use seed::transform::transform;
    let mut data = empty_parsed();
    data.moves = vec![
        MoveRow { id: 100, identifier: "double-edge".into(), generation_id: 1, type_id: 1, power: Some(120), pp: Some(15), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
        MoveRow { id: 101, identifier: "tackle".into(), generation_id: 1, type_id: 1, power: Some(40), pp: Some(35), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
    ];
    data.move_names = vec![
        MoveNameRow { move_id: 100, local_language_id: 9, name: "Double-Edge".into() },
        MoveNameRow { move_id: 101, local_language_id: 9, name: "Tackle".into() },
    ];
    data.move_meta = vec![
        MoveMetaRow { move_id: 100, drain: -33, meta_category_id: 0, meta_ailment_id: 0, min_hits: None, max_hits: None, min_turns: None, max_turns: None, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, stat_chance: 0 },
        MoveMetaRow { move_id: 101, drain: 0, meta_category_id: 0, meta_ailment_id: 0, min_hits: None, max_hits: None, min_turns: None, max_turns: None, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, stat_chance: 0 },
    ];
    let out = transform(data).expect("transform");
    let de = out.move_summaries.iter().find(|m| m.id == 100).unwrap();
    let tackle = out.move_summaries.iter().find(|m| m.id == 101).unwrap();
    assert!(de.flags.contains(&"recoil".to_string()));
    assert!(!tackle.flags.contains(&"recoil".to_string()));
}

#[test]
fn move_flags_sorted_and_deduped() {
    use seed::parse::{MoveFlagMapRow, MoveFlagRow, MoveRow, MoveNameRow};
    use seed::transform::transform;
    let mut data = empty_parsed();
    data.moves = vec![
        MoveRow { id: 1, identifier: "drain-punch".into(), generation_id: 1, type_id: 2, power: Some(75), pp: Some(10), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
    ];
    data.move_names = vec![
        MoveNameRow { move_id: 1, local_language_id: 9, name: "Drain Punch".into() },
    ];
    // Same flag twice + out-of-alpha order.
    data.move_flag_map = vec![
        MoveFlagMapRow { move_id: 1, move_flag_id: 8 },
        MoveFlagMapRow { move_id: 1, move_flag_id: 1 },
        MoveFlagMapRow { move_id: 1, move_flag_id: 8 },
    ];
    data.move_flags = vec![
        MoveFlagRow { id: 1, identifier: "contact".into() },
        MoveFlagRow { id: 8, identifier: "punch".into() },
    ];
    let out = transform(data).expect("transform");
    let dp = out.move_summaries.iter().find(|m| m.id == 1).unwrap();
    assert_eq!(dp.flags, vec!["contact".to_string(), "punch".to_string()]);
}
```

If `empty_parsed()` doesn't already exist in the test file, add it near the top of `transform_tests.rs`:

```rust
fn empty_parsed() -> seed::parse::ParsedData {
    seed::parse::ParsedData {
        pokemon: vec![], pokemon_types: vec![], pokemon_stats: vec![],
        pokemon_species: vec![], pokemon_species_names: vec![],
        types: vec![], type_names: vec![], type_efficacy: vec![],
        moves: vec![], move_names: vec![], pokemon_moves: vec![],
        abilities: vec![], ability_names: vec![], pokemon_abilities: vec![],
        ability_flavor_text: vec![], pokemon_forms: vec![], pokemon_form_names: vec![],
        move_flag_map: vec![], move_flags: vec![], move_meta: vec![],
    }
}
```

(If a helper with a different name already exists, reuse it — the only requirement is fully-zeroed `ParsedData`.)

- [ ] **Step 2: Run tests to verify they fail**

From `backend/`:
```
cargo test -p seed move_flags_
```
Expected: tests fail — flags currently set to `Vec::new()` from Task 1.

- [ ] **Step 3: Implement flag attachment**

In `backend/crates/seed/src/transform.rs`, find the move-summary-build section (around line 637). Above the `move_summaries: Vec<MoveSummary> = data.moves.iter().filter_map(...)` block, add three index/lookup helpers:

```rust
    // Move-flag id → identifier (e.g. 1 → "contact"; 8 → "punch")
    let flag_identifiers: HashMap<i32, String> = data
        .move_flags
        .iter()
        .map(|f| (f.id, f.identifier.clone()))
        .collect();

    // move_id → list of flag-ids
    let mut move_flag_index: HashMap<i32, Vec<i32>> = HashMap::new();
    for r in data.move_flag_map.iter() {
        move_flag_index.entry(r.move_id).or_default().push(r.move_flag_id);
    }

    // move_id → drain (used to derive "recoil")
    let move_drain: HashMap<i32, i32> =
        data.move_meta.iter().map(|m| (m.move_id, m.drain)).collect();

    const FLAG_WHITELIST: &[&str] =
        &["contact", "punch", "bite", "pulse", "sound", "slicing"];
```

(If `HashMap` isn't already in scope at the top of `transform.rs`, add `use std::collections::HashMap;`.)

Then change the `Some(MoveSummary { ... })` construction (around line 648) to compute and attach `flags`:

```rust
            let mut flags: Vec<String> = move_flag_index
                .get(&m.id)
                .map(|ids| {
                    ids.iter()
                        .filter_map(|fid| flag_identifiers.get(fid).cloned())
                        .filter(|ident| FLAG_WHITELIST.contains(&ident.as_str()))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            if move_drain.get(&m.id).copied().unwrap_or(0) < 0 {
                flags.push("recoil".to_string());
            }
            flags.sort();
            flags.dedup();

            Some(MoveSummary {
                id: m.id,
                name,
                names,
                type_ref,
                power: m.power,
                accuracy: m.accuracy,
                pp: m.pp,
                damage_class: damage_class_name(m.damage_class_id),
                flags,
            })
```

- [ ] **Step 4: Run tests to verify they pass**

From `backend/`:
```
cargo test -p seed
```
Expected: all three new tests pass; existing transform tests still pass.

- [ ] **Step 5: Run clippy**

From `backend/`:
```
cargo clippy -p seed -- -D warnings
```
Fix any warnings introduced.

- [ ] **Step 6: Commit**

```
git add backend/crates/seed/src/transform.rs backend/crates/seed/tests/transform_tests.rs
git commit -m "Attach move flags to MoveSummary (contact/punch/bite/pulse/sound/slicing/recoil)"
```

### Task 5: Re-seed and verify the API

**Files:** none (operational task).

- [ ] **Step 1: Re-seed Redis**

From repo root:
```
make seed-local
```
Expected: seed completes; logs show "Loaded N moves" with no errors.

- [ ] **Step 2: Restart the API**

Per CLAUDE.md, kill any running `cargo run -p api` process, then from `backend/`:
```
cargo run -p api
```
Verify it's responding on port 3001 (`curl localhost:3001/api/v1/health`).

- [ ] **Step 3: Verify `flags` field appears in response**

```
curl -s 'http://localhost:3001/api/v1/moves?search=ice-punch' | jq '.[] | select(.name == "ice-punch") | .flags'
```
Expected output: `["contact","punch"]`.

- [ ] **Step 4: Update frontend type**

Edit `frontend/src/lib/types.ts` `MoveSummary`:

```ts
export interface MoveSummary {
  id: number;
  name: string;
  names: LocalizedNames;
  type_ref: TypeRef;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  damage_class: string;
  flags: string[];
}
```

- [ ] **Step 5: Verify the frontend still type-checks**

From `frontend/`:
```
npx tsc --noEmit
```
Expected: TypeScript flags every `MoveSummary` literal that's missing `flags`. Add `flags: []` to:
- `frontend/src/lib/calc/__tests__/damage.test.ts` — the `move` literal inside the `input()` helper (around line 29).
- `frontend/src/app/calc/__tests__/calc-page.test.tsx` — the `getMoves` mock entry (around line 20).
- Any other site the type-checker surfaces.

Re-run `npx tsc --noEmit` until clean.

- [ ] **Step 6: Run frontend tests**

From `frontend/`:
```
npm test -- --run
```
Expected: all 63 existing tests still pass after the literal updates.

- [ ] **Step 7: Commit**

```
git add frontend/src/lib/types.ts frontend/src/lib/calc/__tests__/damage.test.ts frontend/src/app/calc/__tests__/calc-page.test.tsx
git commit -m "Surface MoveSummary.flags on the frontend type"
```

---

# Phase 2 — Frontend: ability data model

### Task 6: Create `move-flags.ts` with `MoveFlag` type and helper

**Files:**
- Create: `frontend/src/lib/calc/move-flags.ts`
- Create: `frontend/src/lib/calc/__tests__/move-flags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/calc/__tests__/move-flags.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { hasMoveFlag } from '../move-flags';
import type { MoveSummary } from '@/lib/types';

function moveWith(flags: string[]): MoveSummary {
  return {
    id: 1, name: 'x',
    names: { en: 'X' },
    type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } },
    power: 50, accuracy: 100, pp: 10, damage_class: 'physical', flags,
  };
}

describe('hasMoveFlag', () => {
  it('returns true when flag is present', () => {
    expect(hasMoveFlag(moveWith(['contact', 'punch']), 'punch')).toBe(true);
  });
  it('returns false when flag is absent', () => {
    expect(hasMoveFlag(moveWith(['contact']), 'punch')).toBe(false);
  });
  it('returns false when flags array is empty', () => {
    expect(hasMoveFlag(moveWith([]), 'sound')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

From `frontend/`:
```
npm test -- move-flags --run
```
Expected: import-resolve failure — `move-flags.ts` doesn't exist.

- [ ] **Step 3: Create the module**

Create `frontend/src/lib/calc/move-flags.ts`:

```ts
import type { MoveSummary } from '@/lib/types';

export type MoveFlag = 'contact' | 'punch' | 'bite' | 'pulse' | 'slicing' | 'sound' | 'recoil';

export function hasMoveFlag(move: MoveSummary, flag: MoveFlag): boolean {
  return move.flags.includes(flag);
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- move-flags --run
```
Expected: 3 passing.

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/move-flags.ts frontend/src/lib/calc/__tests__/move-flags.test.ts
git commit -m "Add hasMoveFlag helper and MoveFlag type"
```

### Task 7: Create `Ability` type and `ABILITIES` roster

**Files:**
- Create: `frontend/src/lib/calc/abilities.ts`
- Create: `frontend/src/lib/calc/__tests__/abilities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/calc/__tests__/abilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ABILITIES, getAbility } from '../abilities';

describe('ABILITIES', () => {
  it('contains the 36 Bundle A abilities', () => {
    const ids = new Set(ABILITIES.map((a) => a.id));
    const expected = [
      'adaptability', 'huge-power', 'pure-power', 'hustle',
      'tough-claws', 'iron-fist', 'strong-jaw', 'mega-launcher', 'sharpness',
      'reckless', 'punk-rock', 'technician',
      'aerilate', 'pixilate', 'refrigerate', 'galvanize',
      'steelworker', 'water-bubble', 'flash-fire',
      'levitate', 'sap-sipper', 'water-absorb', 'volt-absorb',
      'lightning-rod', 'storm-drain', 'motor-drive',
      'thick-fat', 'heatproof',
      'filter', 'solid-rock', 'prism-armor', 'tinted-lens', 'wonder-guard',
      'mold-breaker', 'teravolt', 'turboblaze',
    ];
    for (const id of expected) {
      expect(ids.has(id), `missing ability: ${id}`).toBe(true);
    }
    expect(ABILITIES.length).toBe(36);
  });

  it('every entry has en/ja/zh names', () => {
    for (const a of ABILITIES) {
      expect(a.names.en, `${a.id}.en`).toBeTruthy();
      expect(a.names.ja, `${a.id}.ja`).toBeTruthy();
      expect(a.names.zh, `${a.id}.zh`).toBeTruthy();
    }
  });

  it('getAbility returns undefined for null / unknown', () => {
    expect(getAbility(null)).toBeUndefined();
    expect(getAbility(undefined)).toBeUndefined();
    expect(getAbility('not-a-real-ability')).toBeUndefined();
  });

  it('getAbility returns the entry for a known id', () => {
    expect(getAbility('adaptability')?.stabFactor).toBe(2.0);
    expect(getAbility('huge-power')?.flatAtkMult).toEqual({ stat: 'attack', factor: 2.0 });
    expect(getAbility('mold-breaker')?.ignoresDefenderAbility).toBe(true);
  });

  it('Water Bubble has both offense type boost and defense type reduction', () => {
    const wb = getAbility('water-bubble')!;
    expect(wb.offenseTypeBoost).toEqual({ typeId: 11, factor: 2.0 });
    expect(wb.typeReduction).toEqual([{ typeId: 10, factor: 0.5 }]);
  });

  it('Punk Rock has conditionalDmgMult on sound and soundReduction', () => {
    const pr = getAbility('punk-rock')!;
    expect(pr.conditionalDmgMult).toEqual({ kind: 'flag', flag: 'sound', factor: 1.3 });
    expect(pr.soundReduction).toBe(0.5);
  });

  it('Flash Fire has Fire immunity and Fire offense boost', () => {
    const ff = getAbility('flash-fire')!;
    expect(ff.typeImmunity).toBe(10);
    expect(ff.offenseTypeBoost).toEqual({ typeId: 10, factor: 1.5 });
  });

  it('Thick Fat reduces both Fire and Ice', () => {
    const tf = getAbility('thick-fat')!;
    expect(tf.typeReduction).toEqual([{ typeId: 10, factor: 0.5 }, { typeId: 15, factor: 0.5 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- abilities --run
```
Expected: import-resolve failure.

- [ ] **Step 3: Create `abilities.ts`**

Create `frontend/src/lib/calc/abilities.ts`. Type IDs: Normal=1, Fighting=2, Flying=3, Poison=4, Ground=5, Rock=6, Bug=7, Ghost=8, Steel=9, Fire=10, Water=11, Grass=12, Electric=13, Psychic=14, Ice=15, Dragon=16, Dark=17, Fairy=18.

```ts
import type { LocalizedNames } from '@/lib/types';
import type { MoveFlag } from './move-flags';

export interface Ability {
  id: string;
  names: LocalizedNames;

  // Offensive
  stabFactor?: number;
  flatAtkMult?: { stat: 'attack' | 'special_attack'; factor: number };
  conditionalDmgMult?:
    | { kind: 'flag'; flag: MoveFlag; factor: number }
    | { kind: 'power-le'; powerThreshold: number; factor: number };
  typeChange?: { from: number; to: number; boost: number };
  offenseTypeBoost?: { typeId: number; factor: number };
  notVeryEffectiveBoost?: number;

  // Defensive
  typeImmunity?: number;
  typeReduction?: { typeId: number; factor: number }[];
  soundReduction?: number;
  superEffectiveResist?: number;
  wonderGuard?: boolean;

  // Meta
  ignoresDefenderAbility?: boolean;
}

export const ABILITIES: Ability[] = [
  // ---- STAB / flat stat ----
  { id: 'adaptability', names: { en: 'Adaptability', ja: 'てきおうりょく', zh: '适应力' }, stabFactor: 2.0 },
  { id: 'huge-power',   names: { en: 'Huge Power',   ja: 'ちからもち',   zh: '大力士' }, flatAtkMult: { stat: 'attack', factor: 2.0 } },
  { id: 'pure-power',   names: { en: 'Pure Power',   ja: 'ヨガパワー',   zh: '瑜伽之力' }, flatAtkMult: { stat: 'attack', factor: 2.0 } },
  { id: 'hustle',       names: { en: 'Hustle',       ja: 'はりきり',     zh: '活力' },     flatAtkMult: { stat: 'attack', factor: 1.5 } },

  // ---- Conditional damage ----
  { id: 'tough-claws',  names: { en: 'Tough Claws',  ja: 'かたいツメ',   zh: '硬爪' },     conditionalDmgMult: { kind: 'flag', flag: 'contact', factor: 1.3 } },
  { id: 'iron-fist',    names: { en: 'Iron Fist',    ja: 'てつのこぶし', zh: '铁拳' },     conditionalDmgMult: { kind: 'flag', flag: 'punch',   factor: 1.2 } },
  { id: 'strong-jaw',   names: { en: 'Strong Jaw',   ja: 'がんじょうあご', zh: '强壮之颚' }, conditionalDmgMult: { kind: 'flag', flag: 'bite',    factor: 1.5 } },
  { id: 'mega-launcher',names: { en: 'Mega Launcher',ja: 'メガランチャー', zh: '超级发射器' }, conditionalDmgMult: { kind: 'flag', flag: 'pulse',  factor: 1.5 } },
  { id: 'sharpness',    names: { en: 'Sharpness',    ja: 'きれあじ',     zh: '锋锐' },     conditionalDmgMult: { kind: 'flag', flag: 'slicing', factor: 1.5 } },
  { id: 'reckless',     names: { en: 'Reckless',     ja: 'すてみ',       zh: '舍身' },     conditionalDmgMult: { kind: 'flag', flag: 'recoil',  factor: 1.2 } },
  { id: 'punk-rock',    names: { en: 'Punk Rock',    ja: 'パンクロック', zh: '朋克摇滚' }, conditionalDmgMult: { kind: 'flag', flag: 'sound',   factor: 1.3 }, soundReduction: 0.5 },
  { id: 'technician',   names: { en: 'Technician',   ja: 'テクニシャン', zh: '技术高手' }, conditionalDmgMult: { kind: 'power-le', powerThreshold: 60, factor: 1.5 } },

  // ---- Type change ----
  { id: 'aerilate',     names: { en: 'Aerilate',     ja: 'スカイスキン', zh: '飞行皮肤' }, typeChange: { from: 1, to: 3,  boost: 1.2 } },
  { id: 'pixilate',     names: { en: 'Pixilate',     ja: 'フェアリースキン', zh: '妖精皮肤' }, typeChange: { from: 1, to: 18, boost: 1.2 } },
  { id: 'refrigerate',  names: { en: 'Refrigerate',  ja: 'フリーズスキン', zh: '冰冻皮肤' }, typeChange: { from: 1, to: 15, boost: 1.2 } },
  { id: 'galvanize',    names: { en: 'Galvanize',    ja: 'エレキスキン', zh: '电气皮肤' }, typeChange: { from: 1, to: 13, boost: 1.2 } },

  // ---- Offense type boost ----
  { id: 'steelworker',  names: { en: 'Steelworker',  ja: 'はがねつかい', zh: '钢能力者' }, offenseTypeBoost: { typeId: 9,  factor: 1.5 } },
  { id: 'water-bubble', names: { en: 'Water Bubble', ja: 'すいほう',     zh: '水泡' },     offenseTypeBoost: { typeId: 11, factor: 2.0 }, typeReduction: [{ typeId: 10, factor: 0.5 }] },
  { id: 'flash-fire',   names: { en: 'Flash Fire',   ja: 'もらいび',     zh: '引火' },     typeImmunity: 10, offenseTypeBoost: { typeId: 10, factor: 1.5 } },

  // ---- Type immunity (defender) ----
  { id: 'levitate',      names: { en: 'Levitate',      ja: 'ふゆう',         zh: '飘浮' },     typeImmunity: 5  },
  { id: 'sap-sipper',    names: { en: 'Sap Sipper',    ja: 'そうしょく',     zh: '食草' },     typeImmunity: 12 },
  { id: 'water-absorb',  names: { en: 'Water Absorb',  ja: 'ちょすい',       zh: '储水' },     typeImmunity: 11 },
  { id: 'volt-absorb',   names: { en: 'Volt Absorb',   ja: 'ちくでん',       zh: '蓄电' },     typeImmunity: 13 },
  { id: 'lightning-rod', names: { en: 'Lightning Rod', ja: 'ひらいしん',     zh: '避雷针' },   typeImmunity: 13 },
  { id: 'storm-drain',   names: { en: 'Storm Drain',   ja: 'よびみず',       zh: '引水' },     typeImmunity: 11 },
  { id: 'motor-drive',   names: { en: 'Motor Drive',   ja: 'でんきエンジン', zh: '电气引擎' }, typeImmunity: 13 },

  // ---- Type reduction ----
  { id: 'thick-fat', names: { en: 'Thick Fat', ja: 'あついしぼう', zh: '厚脂肪' }, typeReduction: [{ typeId: 10, factor: 0.5 }, { typeId: 15, factor: 0.5 }] },
  { id: 'heatproof', names: { en: 'Heatproof', ja: 'たいねつ',     zh: '耐热' },   typeReduction: [{ typeId: 10, factor: 0.5 }] },

  // ---- Damage taken ----
  { id: 'filter',       names: { en: 'Filter',       ja: 'フィルター',     zh: '过滤' },     superEffectiveResist: 0.75 },
  { id: 'solid-rock',   names: { en: 'Solid Rock',   ja: 'ハードロック',   zh: '坚硬岩石' }, superEffectiveResist: 0.75 },
  { id: 'prism-armor',  names: { en: 'Prism Armor',  ja: 'プリズムアーマー', zh: '棱镜护甲' }, superEffectiveResist: 0.75 },
  { id: 'tinted-lens',  names: { en: 'Tinted Lens',  ja: 'いろめがね',     zh: '有色眼镜' }, notVeryEffectiveBoost: 2.0 },
  { id: 'wonder-guard', names: { en: 'Wonder Guard', ja: 'ふしぎなまもり', zh: '神奇守护' }, wonderGuard: true },

  // ---- Meta (Mold Breaker family) ----
  { id: 'mold-breaker', names: { en: 'Mold Breaker', ja: 'かたやぶり',     zh: '破格' },     ignoresDefenderAbility: true },
  { id: 'teravolt',     names: { en: 'Teravolt',     ja: 'テラボルテージ', zh: '兆级电压' }, ignoresDefenderAbility: true },
  { id: 'turboblaze',   names: { en: 'Turboblaze',   ja: 'ターボブレイズ', zh: '涡轮火焰' }, ignoresDefenderAbility: true },
];

const ABILITY_INDEX: Record<string, Ability> = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));

export function getAbility(id: string | null | undefined): Ability | undefined {
  return id ? ABILITY_INDEX[id] : undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- abilities --run
```
Expected: all 8 tests in the new file pass.

- [ ] **Step 5: Re-export from index**

`frontend/src/lib/calc/index.ts` uses named re-exports. Add a new line alongside the others:

```ts
export { ABILITIES, getAbility, type Ability } from './abilities';
export { hasMoveFlag, type MoveFlag } from './move-flags';
```

- [ ] **Step 6: Commit**

```
git add frontend/src/lib/calc/abilities.ts frontend/src/lib/calc/__tests__/abilities.test.ts frontend/src/lib/calc/index.ts
git commit -m "Add Ability type and Bundle A roster (36 abilities)"
```

---

# Phase 3 — Frontend: state + URL

### Task 8: Add `abilityId` to `PokemonConfig` (typing only)

**Files:**
- Modify: `frontend/src/lib/calc/types.ts:47-57`
- Modify: `frontend/src/lib/calc/url.ts` (`AttackerState` / `DefenderState` shape, `defaultCalcState`, pack/unpack)

This task only widens the type — no behavior change yet. Subsequent tasks add the reducer and damage-pipeline reads.

- [ ] **Step 1: Add the field to the `PokemonConfig` interface**

In `frontend/src/lib/calc/types.ts`, edit the `PokemonConfig` interface:

```ts
export interface PokemonConfig {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
  abilityId: string | null;
  stages: StatStages;
}
```

- [ ] **Step 2: Add the field to `DefenderState` in url.ts**

`AttackerState extends DefenderState`, so adding `abilityId` to `DefenderState` covers both:

```ts
export interface DefenderState {
  pokemonId: number;
  baseStatsOverride: Stats | null;
  typesOverride: number[] | null;
  level: number;
  ivs: Stats;
  evs: Stats;
  nature: NatureId;
  itemId: string | null;
  abilityId: string | null;
  stages: StatStages;
}
```

- [ ] **Step 3: Default `abilityId: null` in `defaultCalcState`**

```ts
attacker: {
  pokemonId: DEFAULT_ATTACKER_ID,
  baseStatsOverride: null, typesOverride: null,
  level: 50, ivs: { ...max31 }, evs: { ...zero }, nature: 'hardy',
  itemId: null, abilityId: null,
  stages: { ...ZERO_STAGES },
  moveIds: [null, null, null, null],
},
defender: {
  pokemonId: DEFAULT_DEFENDER_ID,
  baseStatsOverride: null, typesOverride: null,
  level: 50, ivs: { ...max31 }, evs: { ...zero }, nature: 'hardy',
  itemId: null, abilityId: null,
  stages: { ...ZERO_STAGES },
},
```

- [ ] **Step 4: Run type-check**

From `frontend/`:
```
npx tsc --noEmit
```
Expected: TypeScript will report missing `abilityId` everywhere a `PokemonConfig`/`DefenderState`/`AttackerState` literal is constructed. Resolve each by adding `abilityId: null`. Sites likely to need the fix:
- `frontend/src/lib/calc/__tests__/damage.test.ts` — both `attacker` and `defender` literals in `input()`
- `frontend/src/lib/calc/__tests__/url.test.ts` — fixture `bad` and `champ` payloads (URL deserialization should already tolerate missing `ab`, but `defaultCalcState()` calls in this file are the issue)
- Other callers will surface from the type-checker.

- [ ] **Step 5: Run tests**

```
npm test -- --run
```
Expected: all existing tests still pass — adding `abilityId: null` keeps behavior identical.

- [ ] **Step 6: Commit**

```
git add frontend/src/lib/calc/types.ts frontend/src/lib/calc/url.ts frontend/src/lib/calc/__tests__/damage.test.ts frontend/src/lib/calc/__tests__/url.test.ts
git commit -m "Add abilityId field to PokemonConfig (typing only)"
```

### Task 9: Pack/unpack `abilityId` in URL serialization

**Files:**
- Modify: `frontend/src/lib/calc/url.ts:84-128`
- Test: `frontend/src/lib/calc/__tests__/url.test.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('url serialization', ...)` block in `frontend/src/lib/calc/__tests__/url.test.ts`:

```ts
  it('roundtrips abilityId on both sides', () => {
    const base = defaultCalcState();
    const s: CalcState = {
      ...base,
      attacker: { ...base.attacker, abilityId: 'tough-claws' },
      defender: { ...base.defender, abilityId: 'levitate' },
    };
    const round = deserializeState(serializeState(s));
    expect(round.attacker.abilityId).toBe('tough-claws');
    expect(round.defender.abilityId).toBe('levitate');
  });

  it('treats missing ab field as null (backward compat)', () => {
    // Old URL payload without `ab` field.
    const old = btoa(JSON.stringify({
      v: 1, m: 't',
      a: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null, mv: [null, null, null, null] },
      d: { p: 1, l: 50,
        e: { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 },
        i: { hp: 31, attack: 31, defense: 31, special_attack: 31, special_defense: 31, speed: 31 },
        n: 'hardy', it: null },
    }));
    const s = deserializeState(old);
    expect(s.attacker.abilityId).toBeNull();
    expect(s.defender.abilityId).toBeNull();
  });

  it('preserves an unknown ability id string (no validation)', () => {
    const base = defaultCalcState();
    const s: CalcState = {
      ...base,
      attacker: { ...base.attacker, abilityId: 'not-a-real-ability' },
    };
    const round = deserializeState(serializeState(s));
    expect(round.attacker.abilityId).toBe('not-a-real-ability');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- url --run
```
Expected: the round-trip and unknown-id tests fail (return null instead of the set id); the backward-compat test should pass already (missing `abilityId` in the literal will throw a TS error, fixed in Task 8).

- [ ] **Step 3: Pack `ab` in `packSide`**

In `frontend/src/lib/calc/url.ts`:

```ts
function packSide(side: AttackerState | DefenderState, isAttacker: boolean): Record<string, unknown> {
  const base: Record<string, unknown> = {
    p: side.pokemonId,
    l: side.level,
    e: side.evs,
    i: side.ivs,
    n: side.nature,
    it: side.itemId,
    ab: side.abilityId,
    bso: side.baseStatsOverride,
    to: side.typesOverride,
    st: side.stages,
  };
  if (isAttacker) base.mv = (side as AttackerState).moveIds;
  return base;
}
```

- [ ] **Step 4: Unpack `ab` in `unpackSide`**

In the same file:

```ts
const itemId = typeof r.it === 'string' ? r.it : null;
const abilityId = typeof r.ab === 'string' ? r.ab : null;
const baseStatsOverride = r.bso ? clampStats(r.bso, 999) : null;
// ...
const side: DefenderState = {
  pokemonId, level, ivs, evs: evsClamped, nature,
  itemId, abilityId, baseStatsOverride, typesOverride, stages,
};
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test -- url --run
```
Expected: all url tests pass (existing + 3 new).

- [ ] **Step 6: Commit**

```
git add frontend/src/lib/calc/url.ts frontend/src/lib/calc/__tests__/url.test.ts
git commit -m "Pack/unpack abilityId in calc URL state"
```

### Task 10: Reducer actions `SET_ATTACKER_ABILITY` / `SET_DEFENDER_ABILITY`

**Files:**
- Modify: `frontend/src/app/calc/page.tsx:30-97`

UI wiring of the dropdown happens in Task 13. This task adds the reducer plumbing only.

- [ ] **Step 1: Add action variants**

In `frontend/src/app/calc/page.tsx`, extend the `Action` union (around line 30):

```ts
type Action =
  | { type: 'SET_EV_MODE'; mode: EVMode }
  | { type: 'SET_ATTACKER_POKEMON'; id: number; preserveMoves?: boolean }
  | { type: 'SET_DEFENDER_POKEMON'; id: number }
  | { type: 'SET_ATTACKER_LEVEL'; level: number }
  | { type: 'SET_DEFENDER_LEVEL'; level: number }
  | { type: 'SET_ATTACKER_EVS'; evs: Stats }
  | { type: 'SET_DEFENDER_EVS'; evs: Stats }
  | { type: 'SET_ATTACKER_IVS'; ivs: Stats }
  | { type: 'SET_DEFENDER_IVS'; ivs: Stats }
  | { type: 'SET_ATTACKER_NATURE'; nature: NatureId }
  | { type: 'SET_DEFENDER_NATURE'; nature: NatureId }
  | { type: 'SET_ATTACKER_ITEM'; itemId: string | null }
  | { type: 'SET_DEFENDER_ITEM'; itemId: string | null }
  | { type: 'SET_ATTACKER_ABILITY'; abilityId: string | null }   // NEW
  | { type: 'SET_DEFENDER_ABILITY'; abilityId: string | null }   // NEW
  | { type: 'SET_ATTACKER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_DEFENDER_OVERRIDE'; base: Stats | null; types: number[] | null }
  | { type: 'SET_ATTACKER_STAGE'; stat: keyof StatStages; value: number }
  | { type: 'SET_DEFENDER_STAGE'; stat: keyof StatStages; value: number }
  | { type: 'SET_MOVE'; slot: 0 | 1 | 2 | 3; moveId: number | null }
  | { type: 'HYDRATE'; state: CalcState };
```

- [ ] **Step 2: Handle the actions**

Add two cases in the `switch (action.type)` block of `calcReducer`, right after `SET_DEFENDER_ITEM`:

```ts
case 'SET_ATTACKER_ABILITY':  return { ...state, attacker: { ...state.attacker, abilityId: action.abilityId } };
case 'SET_DEFENDER_ABILITY':  return { ...state, defender: { ...state.defender, abilityId: action.abilityId } };
```

- [ ] **Step 3: Verify it compiles**

```
npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Verify tests still pass**

```
npm test -- --run
```

- [ ] **Step 5: Commit**

```
git add frontend/src/app/calc/page.tsx
git commit -m "Add SET_*_ABILITY reducer actions to calc"
```

---

# Phase 4 — Frontend: damage pipeline integration

This is the meatiest section. We integrate ability effects into `damage.ts` in TDD steps grouped by category. After each category lands, the calc gains a slice of capability and the existing tests still pass.

### Task 11: Resolve effective move type (Pixilate / Aerilate / Refrigerate / Galvanize)

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

Append inside `describe('calculateDamage', ...)` in `damage.test.ts`:

```ts
  it('Pixilate converts a Normal-type move to Fairy with ×1.2 boost and applies STAB to a Fairy attacker', () => {
    // Sylveon-like attacker (Fairy = type 18).
    const tackle = input({}).move; // Normal (id 1), 40 BP
    const baseline = calculateDamage(input({})) as { rolls: number[]; modifiers: { stab: number; typeEff: number } };
    const pixilated = calculateDamage(input({
      attackerSpecies: { types: [18], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'pixilate' },
    })) as { rolls: number[]; modifiers: { stab: number; typeEff: number; abilityAtk: number } };
    // STAB now applies (move resolved to Fairy, attacker is Fairy).
    expect(pixilated.modifiers.stab).toBe(1.5);
    // typeChange boost surfaces in abilityAtk.
    expect(pixilated.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
    // Damage strictly greater than baseline (no Pixilate).
    expect(pixilated.rolls[0]).toBeGreaterThan(baseline.rolls[0]);
    // Tackle is still ≠ status; sanity check on type_ref (we don't mutate the move).
    expect(tackle.type_ref.id).toBe(1);
  });

  it('Aerilate converts a Normal-type move to Flying with ×1.2 boost (Body Slam test, since Return is variable-power)', () => {
    const bodySlam = { id: 34, name: 'body-slam', names: { en: 'Body Slam' }, type_ref: { id: 1, name: 'normal', names: { en: 'Normal' } }, power: 85, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact'] };
    // Salamence-Mega-like attacker (Dragon=16, Flying=3).
    const out = calculateDamage(input({
      move: bodySlam,
      attackerSpecies: { types: [16, 3], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'aerilate' },
    })) as { modifiers: { stab: number; abilityAtk: number } };
    expect(out.modifiers.stab).toBe(1.5); // STAB on the Flying-converted move
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
  });

  it('typeChange does not fire on a non-Normal move', () => {
    const fireMove = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const out = calculateDamage(input({
      move: fireMove,
      attacker: { ...input({}).attacker, abilityId: 'pixilate' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBe(1.0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- damage --run
```
Expected: failures — `abilityAtk` field doesn't exist on `modifiers`; STAB / type-conversion behavior absent.

- [ ] **Step 3: Add `abilityAtk` and `abilityDef` to `CalcResult.modifiers` type**

In `frontend/src/lib/calc/types.ts`:

```ts
export interface CalcResult {
  rolls: number[];
  defenderHp: number;
  minPct: number;
  maxPct: number;
  avgPct: number;
  ohkoPct: number;
  twoHkoPct: number;
  threeHkoPct: number;
  qualifier: string;
  modifiers: {
    stab: number;
    typeEff: number;
    item: number;
    berry: number;
    abilityAtk: number;   // NEW
    abilityDef: number;   // NEW
  };
  attackerStat: number;
  defenderStat: number;
}
```

- [ ] **Step 4: Implement type-change resolution + abilityAtk plumbing in damage.ts**

Open `frontend/src/lib/calc/damage.ts`. Near the top, add the import:

```ts
import { getAbility } from './abilities';
import { hasMoveFlag } from './move-flags';
```

Inside `calculateDamage`, after the unsupported-move guards and before the `aBase`/`dBase` lines, add:

```ts
  const atkAbility = getAbility(attacker.abilityId);
  let defAbility = getAbility(defender.abilityId);
  if (atkAbility?.ignoresDefenderAbility) defAbility = undefined;

  // Resolve effective move type (Aerilate / Pixilate / Refrigerate / Galvanize).
  let moveType = move.type_ref.id;
  let typeChangeBoost = 1.0;
  if (atkAbility?.typeChange && atkAbility.typeChange.from === moveType) {
    moveType = atkAbility.typeChange.to;
    typeChangeBoost = atkAbility.typeChange.boost;
  }
```

Down where the type-effectiveness loop reads `move.type_ref.id`, replace each occurrence with `moveType`. There are three spots:

1. The type-effectiveness loop:
   ```ts
   for (const dType of dTypes) {
     const factor = (typeEfficacy[moveType]?.[dType] ?? 100) / 100;
     typeEff *= factor;
   }
   ```

2. The item `typeBoost` gate:
   ```ts
   if (item.typeBoost && item.typeBoost.typeId === moveType) {
     itemMultDamage *= item.typeBoost.factor;
   }
   ```

3. The defender berry `defenderResistance.typeId` match:
   ```ts
   const matchesType = moveType === r.typeId;
   ```

The STAB line stays where it is for now — Adaptability comes in Task 12. Just swap `move.type_ref.id` for `moveType`:

```ts
const stab = aTypes.includes(moveType) ? 1.5 : 1.0;
```

Add an `abilityDmgMult` accumulator and seed it with `typeChangeBoost`:

```ts
let abilityDmgMult = typeChangeBoost;
const abilityDefMult = 1.0;  // populated in later tasks
```

Update the per-roll loop to multiply in `abilityDmgMult * abilityDefMult`:

```ts
for (let i = 85; i <= 100; i++) {
  const roll = i / 100;
  const dmg = typeEff === 0 ? 0
    : Math.floor(baseDamage * stab * typeEff * itemMultDamage * berryMultDamage * abilityDmgMult * abilityDefMult * roll);
  rolls.push(dmg);
}
```

Update `result.modifiers` to include the two new fields:

```ts
modifiers: { stab, typeEff, item: itemMultDamage, berry: berryMultDamage, abilityAtk: abilityDmgMult, abilityDef: abilityDefMult },
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test -- damage --run
```
Expected: the three new tests pass; all existing damage tests still pass.

- [ ] **Step 6: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/types.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Resolve ability typeChange in damage pipeline (Pixilate / Aerilate / Refrigerate / Galvanize)"
```

### Task 12: Adaptability (STAB factor override)

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

Append:

```ts
  it('Adaptability boosts STAB to 2.0 on STAB hits and is no-op on non-STAB', () => {
    // STAB: attackerSpecies has type 1 (Normal) and tackle is Normal.
    const stab = calculateDamage(input({
      attacker: { ...input({}).attacker, abilityId: 'adaptability' },
    })) as { modifiers: { stab: number } };
    expect(stab.modifiers.stab).toBe(2.0);

    // Non-STAB: attackerSpecies is type 10 (Fire), move is Normal.
    const noStab = calculateDamage(input({
      attackerSpecies: { types: [10], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'adaptability' },
    })) as { modifiers: { stab: number } };
    expect(noStab.modifiers.stab).toBe(1.0);
  });
```

- [ ] **Step 2: Run test (should fail)**

```
npm test -- damage --run
```

- [ ] **Step 3: Implement**

In `damage.ts`, replace the hardcoded `1.5` in the STAB line:

```ts
const stabFactor = atkAbility?.stabFactor ?? 1.5;
const stab = aTypes.includes(moveType) ? stabFactor : 1.0;
```

- [ ] **Step 4: Run tests (should pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply Adaptability stabFactor in damage pipeline"
```

### Task 13: Flat attacker stat mults (Huge Power, Pure Power, Hustle)

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
  it('Huge Power doubles physical attackerStat (and not special_attack)', () => {
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const huge = calculateDamage(input({
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(huge.attackerStat).toBe(Math.floor(baseline.attackerStat * 2));

    // Special move: Huge Power must NOT apply (gated to 'attack').
    const surf = { id: 57, name: 'surf', names: { en: 'Surf' }, type_ref: { id: 11, name: 'water', names: { en: 'Water' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const surfNoAbility = calculateDamage(input({ move: surf })) as { attackerStat: number };
    const surfHuge = calculateDamage(input({
      move: surf,
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(surfHuge.attackerStat).toBe(surfNoAbility.attackerStat);
  });

  it('Huge Power does NOT boost Body Press (offenseKey is "defense")', () => {
    const bodyPress = { id: 776, name: 'body-press', names: { en: 'Body Press' }, type_ref: { id: 2, name: 'fighting', names: { en: 'Fighting' } }, power: 80, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: ['contact'] };
    const noAbility = calculateDamage(input({ move: bodyPress })) as { attackerStat: number };
    const withHuge = calculateDamage(input({
      move: bodyPress,
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(withHuge.attackerStat).toBe(noAbility.attackerStat);
  });

  it('Huge Power does NOT boost Foul Play (offense source is defender)', () => {
    const foulPlay = { id: 492, name: 'foul-play', names: { en: 'Foul Play' }, type_ref: { id: 17, name: 'dark', names: { en: 'Dark' } }, power: 95, accuracy: 100, pp: 15, damage_class: 'physical' as const, flags: ['contact'] };
    const noAbility = calculateDamage(input({ move: foulPlay })) as { attackerStat: number };
    const withHuge = calculateDamage(input({
      move: foulPlay,
      attacker: { ...input({}).attacker, abilityId: 'huge-power' },
    })) as { attackerStat: number };
    expect(withHuge.attackerStat).toBe(noAbility.attackerStat);
  });

  it('Choice Band + Huge Power stack with two successive floors', () => {
    const baseline = calculateDamage(input({})) as { attackerStat: number };
    const both = calculateDamage(input({
      attacker: { ...input({}).attacker, abilityId: 'huge-power', itemId: 'choice-band' },
    })) as { attackerStat: number };
    // Order: Huge Power applied first (×2), then Choice Band (×1.5). Each floors.
    expect(both.attackerStat).toBe(Math.floor(Math.floor(baseline.attackerStat * 2) * 1.5));
  });
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement**

In `damage.ts`, after `let A = offenseStats[offenseKey];` and **before** the existing item `attackMult` block, insert:

```ts
  // Attacker flat stat mult — Huge Power, Pure Power, Hustle.
  // Applied BEFORE item attackMult so successive Math.floor steps stay consistent.
  if (atkAbility?.flatAtkMult
      && offenseSide === 'attacker'
      && atkAbility.flatAtkMult.stat === offenseKey) {
    A = Math.floor(A * atkAbility.flatAtkMult.factor);
  }
```

- [ ] **Step 4: Run tests (pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply ability flatAtkMult (Huge Power, Pure Power, Hustle)"
```

### Task 14: Defender type immunity (Levitate, Sap Sipper, Water Absorb, etc.)

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
  it('Levitate makes Earthquake do 0 damage', () => {
    const eq = { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: [] };
    const out = calculateDamage(input({
      move: eq,
      defender: { ...input({}).defender, abilityId: 'levitate' },
    })) as { rolls: number[]; modifiers: { typeEff: number } };
    expect(out.modifiers.typeEff).toBe(0);
    expect(out.rolls.every((r) => r === 0)).toBe(true);
  });

  it('Mold Breaker neutralizes Levitate — Earthquake hits normally', () => {
    const eq = { id: 89, name: 'earthquake', names: { en: 'Earthquake' }, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, power: 100, accuracy: 100, pp: 10, damage_class: 'physical' as const, flags: [] };
    const out = calculateDamage(input({
      move: eq,
      defender: { ...input({}).defender, abilityId: 'levitate' },
      attacker: { ...input({}).attacker, abilityId: 'mold-breaker' },
    })) as { modifiers: { typeEff: number } };
    expect(out.modifiers.typeEff).toBe(1.0); // identity efficacy table — neutral hit
  });

  it('Water Absorb makes a Water move do 0', () => {
    const surf = { id: 57, name: 'surf', names: { en: 'Surf' }, type_ref: { id: 11, name: 'water', names: { en: 'Water' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const out = calculateDamage(input({
      move: surf,
      defender: { ...input({}).defender, abilityId: 'water-absorb' },
    })) as { rolls: number[] };
    expect(out.rolls.every((r) => r === 0)).toBe(true);
  });
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement**

In `damage.ts`, replace the existing type-eff loop with a guarded version. The current code is:

```ts
let typeEff = 1.0;
for (const dType of dTypes) {
  const factor = (typeEfficacy[moveType]?.[dType] ?? 100) / 100;
  typeEff *= factor;
}
```

Change to:

```ts
let typeEff = 1.0;
if (defAbility?.typeImmunity === moveType) {
  typeEff = 0;
} else {
  for (const dType of dTypes) {
    const factor = (typeEfficacy[moveType]?.[dType] ?? 100) / 100;
    typeEff *= factor;
  }
}
```

- [ ] **Step 4: Run tests (pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply defender ability typeImmunity (Levitate, Water Absorb, Sap Sipper, etc.) and Mold Breaker bypass"
```

### Task 15: Defender type reduction (Thick Fat, Heatproof, Water Bubble def)

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
  it('Thick Fat halves Fire and Ice; other types unaffected', () => {
    const flame = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const ice = { id: 196, name: 'ice-beam', names: { en: 'Ice Beam' }, type_ref: { id: 15, name: 'ice', names: { en: 'Ice' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const electric = { id: 87, name: 'thunder', names: { en: 'Thunder' }, type_ref: { id: 13, name: 'electric', names: { en: 'Electric' } }, power: 110, accuracy: 70, pp: 10, damage_class: 'special' as const, flags: [] };
    const fire = calculateDamage(input({ move: flame, defender: { ...input({}).defender, abilityId: 'thick-fat' } })) as { modifiers: { typeEff: number } };
    const cold = calculateDamage(input({ move: ice,   defender: { ...input({}).defender, abilityId: 'thick-fat' } })) as { modifiers: { typeEff: number } };
    const elec = calculateDamage(input({ move: electric, defender: { ...input({}).defender, abilityId: 'thick-fat' } })) as { modifiers: { typeEff: number } };
    expect(fire.modifiers.typeEff).toBe(0.5);
    expect(cold.modifiers.typeEff).toBe(0.5);
    expect(elec.modifiers.typeEff).toBe(1.0);
  });

  it('Heatproof halves Fire only', () => {
    const flame = { id: 53, name: 'flamethrower', names: { en: 'Flamethrower' }, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } }, power: 90, accuracy: 100, pp: 15, damage_class: 'special' as const, flags: [] };
    const ice = { id: 196, name: 'ice-beam', names: { en: 'Ice Beam' }, type_ref: { id: 15, name: 'ice', names: { en: 'Ice' } }, power: 90, accuracy: 100, pp: 10, damage_class: 'special' as const, flags: [] };
    const fire = calculateDamage(input({ move: flame, defender: { ...input({}).defender, abilityId: 'heatproof' } })) as { modifiers: { typeEff: number } };
    const cold = calculateDamage(input({ move: ice, defender: { ...input({}).defender, abilityId: 'heatproof' } })) as { modifiers: { typeEff: number } };
    expect(fire.modifiers.typeEff).toBe(0.5);
    expect(cold.modifiers.typeEff).toBe(1.0);
  });
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement**

In `damage.ts`, inside the `else` branch of the type-immunity check, after the type-eff loop, add:

```ts
} else {
  for (const dType of dTypes) {
    const factor = (typeEfficacy[moveType]?.[dType] ?? 100) / 100;
    typeEff *= factor;
  }
  if (defAbility?.typeReduction) {
    for (const r of defAbility.typeReduction) {
      if (r.typeId === moveType) typeEff *= r.factor;
    }
  }
}
```

- [ ] **Step 4: Run tests (pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply defender ability typeReduction (Thick Fat, Heatproof, Water Bubble)"
```

### Task 16: Wonder Guard, Filter / Solid Rock / Prism Armor, Tinted Lens

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

The identity efficacy table makes "super effective" hard to express without a custom table. We'll build a 2× table for these tests:

```ts
  function withSEEfficacy(): number[][] {
    // Identity by default; attacking type 1 vs defending type 5 = 200% (super effective).
    const m = Array.from({ length: 19 }, () => Array(19).fill(100));
    m[1][5] = 200;
    // attacking type 1 vs defending type 7 = 50% (NVE).
    m[1][7] = 50;
    return m;
  }

  it('Filter reduces super-effective damage by 0.75', () => {
    const m = withSEEfficacy();
    const noAbility = calculateDamage(input({
      defenderSpecies: { types: [5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: m,
    })) as { modifiers: { typeEff: number } };
    const filtered = calculateDamage(input({
      defenderSpecies: { types: [5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: m,
      defender: { ...input({}).defender, abilityId: 'filter' },
    })) as { modifiers: { typeEff: number } };
    expect(noAbility.modifiers.typeEff).toBe(2.0);
    expect(filtered.modifiers.typeEff).toBe(2.0 * 0.75);
  });

  it('Mold Breaker neutralizes Filter', () => {
    const m = withSEEfficacy();
    const out = calculateDamage(input({
      defenderSpecies: { types: [5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: m,
      defender: { ...input({}).defender, abilityId: 'filter' },
      attacker: { ...input({}).attacker, abilityId: 'mold-breaker' },
    })) as { modifiers: { typeEff: number } };
    expect(out.modifiers.typeEff).toBe(2.0);
  });

  it('Tinted Lens doubles damage on NVE hits', () => {
    const m = withSEEfficacy();
    const noAbility = calculateDamage(input({
      defenderSpecies: { types: [7], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: m,
    })) as { modifiers: { typeEff: number } };
    const tl = calculateDamage(input({
      defenderSpecies: { types: [7], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: m,
      attacker: { ...input({}).attacker, abilityId: 'tinted-lens' },
    })) as { modifiers: { typeEff: number } };
    expect(noAbility.modifiers.typeEff).toBe(0.5);
    expect(tl.modifiers.typeEff).toBe(1.0);
  });

  it('Wonder Guard zeroes neutral damage; super-effective passes through', () => {
    const m = withSEEfficacy();
    const neutral = calculateDamage(input({
      typeEfficacy: m,
      defender: { ...input({}).defender, abilityId: 'wonder-guard' },
    })) as { modifiers: { typeEff: number }; rolls: number[] };
    const se = calculateDamage(input({
      defenderSpecies: { types: [5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      typeEfficacy: m,
      defender: { ...input({}).defender, abilityId: 'wonder-guard' },
    })) as { modifiers: { typeEff: number }; rolls: number[] };
    expect(neutral.modifiers.typeEff).toBe(0);
    expect(neutral.rolls.every((r) => r === 0)).toBe(true);
    expect(se.modifiers.typeEff).toBe(2.0);
    expect(se.rolls[0]).toBeGreaterThan(0);
  });
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement**

Extend the `else` block in `damage.ts` after the typeReduction loop:

```ts
  if (defAbility?.wonderGuard && typeEff > 0 && typeEff <= 1) typeEff = 0;
  if (defAbility?.superEffectiveResist && typeEff > 1) typeEff *= defAbility.superEffectiveResist;
  if (atkAbility?.notVeryEffectiveBoost && typeEff > 0 && typeEff < 1) typeEff *= atkAbility.notVeryEffectiveBoost;
}
```

- [ ] **Step 4: Run tests (pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply Wonder Guard, Filter/Solid Rock/Prism Armor, Tinted Lens"
```

### Task 17: Conditional damage mults (flag + power-le) and offense type boost

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
  it('Tough Claws boosts contact moves by 1.3', () => {
    const tackle = input({}).move; // contact (we set flags below)
    const contactTackle = { ...tackle, flags: ['contact'] };
    const noContact = { ...tackle, flags: [] };
    const tc = calculateDamage(input({
      move: contactTackle,
      attacker: { ...input({}).attacker, abilityId: 'tough-claws' },
    })) as { modifiers: { abilityAtk: number } };
    expect(tc.modifiers.abilityAtk).toBeCloseTo(1.3, 5);
    const noBoost = calculateDamage(input({
      move: noContact,
      attacker: { ...input({}).attacker, abilityId: 'tough-claws' },
    })) as { modifiers: { abilityAtk: number } };
    expect(noBoost.modifiers.abilityAtk).toBe(1.0);
  });

  it('Iron Fist boosts punch moves only', () => {
    const punch = { ...input({}).move, flags: ['contact', 'punch'] };
    const slap = { ...input({}).move, flags: ['contact'] };
    const a = calculateDamage(input({ move: punch, attacker: { ...input({}).attacker, abilityId: 'iron-fist' } })) as { modifiers: { abilityAtk: number } };
    const b = calculateDamage(input({ move: slap,  attacker: { ...input({}).attacker, abilityId: 'iron-fist' } })) as { modifiers: { abilityAtk: number } };
    expect(a.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
    expect(b.modifiers.abilityAtk).toBe(1.0);
  });

  it('Reckless boosts recoil moves by 1.2', () => {
    const recoil = { ...input({}).move, flags: ['contact', 'recoil'] };
    const out = calculateDamage(input({ move: recoil, attacker: { ...input({}).attacker, abilityId: 'reckless' } })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.2, 5);
  });

  it('Technician boosts ≤60 BP by 1.5; 61 BP unchanged', () => {
    const sixty = { ...input({}).move, power: 60 };
    const sixtyone = { ...input({}).move, power: 61 };
    const a = calculateDamage(input({ move: sixty,    attacker: { ...input({}).attacker, abilityId: 'technician' } })) as { modifiers: { abilityAtk: number } };
    const b = calculateDamage(input({ move: sixtyone, attacker: { ...input({}).attacker, abilityId: 'technician' } })) as { modifiers: { abilityAtk: number } };
    expect(a.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
    expect(b.modifiers.abilityAtk).toBe(1.0);
  });

  it('Steelworker boosts Steel-type moves by 1.5', () => {
    const ironHead = { ...input({}).move, type_ref: { id: 9, name: 'steel', names: { en: 'Steel' } } };
    const out = calculateDamage(input({ move: ironHead, attacker: { ...input({}).attacker, abilityId: 'steelworker' } })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Flash Fire boosts Fire-type moves by 1.5 (default-on)', () => {
    const flame = { ...input({}).move, type_ref: { id: 10, name: 'fire', names: { en: 'Fire' } } };
    const out = calculateDamage(input({ move: flame, attacker: { ...input({}).attacker, abilityId: 'flash-fire' } })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.5, 5);
  });

  it('Water Bubble doubles Water moves on offense', () => {
    const surf = { ...input({}).move, type_ref: { id: 11, name: 'water', names: { en: 'Water' } } };
    const out = calculateDamage(input({ move: surf, attacker: { ...input({}).attacker, abilityId: 'water-bubble' } })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(2.0, 5);
  });
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement**

In `damage.ts`, after the existing item / berry mult block and before the `baseDamage` / roll loop, replace `let abilityDmgMult = typeChangeBoost;` (placed in Task 11) with the full computation:

```ts
let abilityDmgMult = typeChangeBoost;
if (atkAbility?.conditionalDmgMult) {
  const c = atkAbility.conditionalDmgMult;
  const matches = c.kind === 'flag'
    ? hasMoveFlag(move, c.flag)
    : (move.power ?? 0) <= c.powerThreshold;
  if (matches) abilityDmgMult *= c.factor;
}
if (atkAbility?.offenseTypeBoost && atkAbility.offenseTypeBoost.typeId === moveType) {
  abilityDmgMult *= atkAbility.offenseTypeBoost.factor;
}
```

- [ ] **Step 4: Run tests (pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply ability conditional/offense damage mults (Tough Claws, Iron Fist, Reckless, Technician, Steelworker, Flash Fire, Water Bubble)"
```

### Task 18: Punk Rock defense (sound reduction)

**Files:**
- Modify: `frontend/src/lib/calc/damage.ts`
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
  it('Punk Rock halves sound moves on the defender; non-sound unaffected', () => {
    const boomburst = { ...input({}).move, flags: ['sound'] };
    const tackle = { ...input({}).move, flags: ['contact'] };
    const sound = calculateDamage(input({
      move: boomburst,
      defender: { ...input({}).defender, abilityId: 'punk-rock' },
    })) as { modifiers: { abilityDef: number } };
    const noSound = calculateDamage(input({
      move: tackle,
      defender: { ...input({}).defender, abilityId: 'punk-rock' },
    })) as { modifiers: { abilityDef: number } };
    expect(sound.modifiers.abilityDef).toBe(0.5);
    expect(noSound.modifiers.abilityDef).toBe(1.0);
  });

  it('Punk Rock attacker boosts sound moves by 1.3 (offense path)', () => {
    const boomburst = { ...input({}).move, flags: ['sound'] };
    const out = calculateDamage(input({
      move: boomburst,
      attacker: { ...input({}).attacker, abilityId: 'punk-rock' },
    })) as { modifiers: { abilityAtk: number } };
    expect(out.modifiers.abilityAtk).toBeCloseTo(1.3, 5);
  });
```

- [ ] **Step 2: Run tests (fail)**

- [ ] **Step 3: Implement**

In `damage.ts`, replace `const abilityDefMult = 1.0;` (placeholder from Task 11) with the actual logic, placed *after* the offense-type-boost block and before `baseDamage`:

```ts
let abilityDefMult = 1.0;
if (defAbility?.soundReduction && hasMoveFlag(move, 'sound')) {
  abilityDefMult *= defAbility.soundReduction;
}
```

- [ ] **Step 4: Run tests (pass)**

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/calc/damage.ts frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Apply Punk Rock soundReduction on defender"
```

### Task 19: Final damage-pipeline regression sweep

**Files:**
- Test: `frontend/src/lib/calc/__tests__/damage.test.ts`

This task adds no production code. It locks in two cross-cutting invariants and finishes verification.

- [ ] **Step 1: Append regression tests**

```ts
  it('with abilityId null on both sides, calc reduces to existing behavior (regression guard)', () => {
    const out = calculateDamage(input({})) as { modifiers: { abilityAtk: number; abilityDef: number; stab: number } };
    expect(out.modifiers.abilityAtk).toBe(1.0);
    expect(out.modifiers.abilityDef).toBe(1.0);
    expect(out.modifiers.stab).toBe(1.5); // existing default
  });

  it('Mold Breaker on attacker does not affect own ability', () => {
    // Choose an attacker ability that's also attacker-side: Adaptability (stabFactor).
    // Mold Breaker is a meta ability, so the user can't have *both*. Verify Mold Breaker
    // applied to a defender ability still leaves attacker effects untouched.
    const eq = { ...input({}).move, type_ref: { id: 5, name: 'ground', names: { en: 'Ground' } }, flags: [] };
    const out = calculateDamage(input({
      move: eq,
      attackerSpecies: { types: [5], baseStats: { hp: 100, attack: 100, defense: 100, special_attack: 100, special_defense: 100, speed: 100 } },
      attacker: { ...input({}).attacker, abilityId: 'mold-breaker' },
      defender: { ...input({}).defender, abilityId: 'levitate' },
    })) as { modifiers: { stab: number; typeEff: number } };
    expect(out.modifiers.stab).toBe(1.5); // attacker is Ground, EQ is Ground → STAB
    expect(out.modifiers.typeEff).toBe(1.0); // Levitate suppressed
  });
```

- [ ] **Step 2: Run all damage tests**

```
npm test -- damage --run
```
Expected: every test in the file (existing + every test added in Tasks 11–19) passes.

- [ ] **Step 3: Commit**

```
git add frontend/src/lib/calc/__tests__/damage.test.ts
git commit -m "Add regression guard: ability-null behavior preserved bit-for-bit"
```

---

# Phase 5 — Frontend: UI

### Task 20: i18n keys for the ability dropdown

**Files:**
- Modify: `frontend/src/lib/i18n/translations.ts`

- [ ] **Step 1: Add English keys**

In the English block of `frontend/src/lib/i18n/translations.ts`, alongside `calc.itemNone`/`calc.itemTier.*` (around line 40):

```ts
'calc.ability': 'Ability',
'calc.ability.none': 'No ability',
'calc.ability.thisPokemon': 'This Pokémon',
'calc.ability.all': 'All abilities',
```

- [ ] **Step 2: Add Japanese keys**

In the Japanese block (around line 237):

```ts
'calc.ability': 'とくせい',
'calc.ability.none': 'なし',
'calc.ability.thisPokemon': 'このポケモン',
'calc.ability.all': 'すべての特性',
```

- [ ] **Step 3: Add Chinese keys**

In the Chinese block (around line 426):

```ts
'calc.ability': '特性',
'calc.ability.none': '无特性',
'calc.ability.thisPokemon': '本宝可梦',
'calc.ability.all': '全部特性',
```

- [ ] **Step 4: Verify type-check**

```
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```
git add frontend/src/lib/i18n/translations.ts
git commit -m "Add calc.ability.* i18n keys (en/ja/zh)"
```

### Task 21: `AbilityDropdown` component

**Files:**
- Create: `frontend/src/components/AbilityDropdown.tsx`
- Create: `frontend/src/components/__tests__/AbilityDropdown.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/components/__tests__/AbilityDropdown.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/lib/i18n';
import AbilityDropdown from '../AbilityDropdown';
import type { AbilityInfo } from '@/lib/types';

function wrap(node: React.ReactNode) {
  return render(<LocaleProvider>{node}</LocaleProvider>);
}

const sampleSpeciesAbilities: AbilityInfo[] = [
  { name: 'tough-claws',  names: { en: 'Tough Claws' },  description: { en: '' }, is_hidden: false },
  { name: 'unknown-thing', names: { en: 'Unknown Thing' }, description: { en: '' }, is_hidden: false },
];

describe('AbilityDropdown', () => {
  it('renders a "no ability" leading option and the full roster', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={[]} />);
    expect(screen.getByRole('option', { name: 'No ability' })).toBeTruthy();
    // A handful of roster entries:
    expect(screen.getByRole('option', { name: 'Adaptability' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Mold Breaker' })).toBeTruthy();
  });

  it('shows the "This Pokémon" group when the species has roster-known abilities', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={sampleSpeciesAbilities} />);
    // Tough Claws should appear in the species-group (group label rendered as optgroup).
    expect(screen.getByText('This Pokémon')).toBeTruthy();
  });

  it('hides the "This Pokémon" group when no species ability is in the roster', () => {
    wrap(<AbilityDropdown value={null} onChange={() => {}} speciesAbilities={[
      { name: 'unknown-1', names: { en: 'Unknown 1' }, description: { en: '' }, is_hidden: false },
    ]} />);
    expect(screen.queryByText('This Pokémon')).toBeNull();
  });

  it('fires onChange(null) when "No ability" is selected', () => {
    const onChange = vi.fn();
    wrap(<AbilityDropdown value={'tough-claws'} onChange={onChange} speciesAbilities={[]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('fires onChange(id) when a roster entry is selected', () => {
    const onChange = vi.fn();
    wrap(<AbilityDropdown value={null} onChange={onChange} speciesAbilities={[]} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'levitate' } });
    expect(onChange).toHaveBeenCalledWith('levitate');
  });
});
```

- [ ] **Step 2: Run tests (fail — module missing)**

```
npm test -- AbilityDropdown --run
```

- [ ] **Step 3: Create the component**

Create `frontend/src/components/AbilityDropdown.tsx`:

```tsx
'use client';

import { ABILITIES } from '@/lib/calc';
import type { AbilityInfo } from '@/lib/types';
import { useLocale, localizedName } from '@/lib/i18n';

interface Props {
  value: string | null;
  onChange: (abilityId: string | null) => void;
  speciesAbilities: AbilityInfo[];
}

export default function AbilityDropdown({ value, onChange, speciesAbilities }: Props) {
  const { locale, t } = useLocale();
  const rosterIds = new Set(ABILITIES.map((a) => a.id));
  const speciesRoster = ABILITIES.filter((a) =>
    speciesAbilities.some((s) => s.name === a.id) && rosterIds.has(a.id),
  );
  const allSorted = [...ABILITIES].sort((a, b) =>
    localizedName(a.names, locale).localeCompare(localizedName(b.names, locale)),
  );
  return (
    <select
      aria-label={t('calc.ability')}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
    >
      <option value="">{t('calc.ability.none')}</option>
      {speciesRoster.length > 0 && (
        <optgroup label={t('calc.ability.thisPokemon')}>
          {speciesRoster.map((a) => (
            <option key={a.id} value={a.id}>{localizedName(a.names, locale)}</option>
          ))}
        </optgroup>
      )}
      <optgroup label={t('calc.ability.all')}>
        {allSorted.map((a) => (
          <option key={a.id} value={a.id}>{localizedName(a.names, locale)}</option>
        ))}
      </optgroup>
    </select>
  );
}
```

- [ ] **Step 4: Run tests (pass)**

```
npm test -- AbilityDropdown --run
```

- [ ] **Step 5: Commit**

```
git add frontend/src/components/AbilityDropdown.tsx frontend/src/components/__tests__/AbilityDropdown.test.tsx
git commit -m "Add AbilityDropdown component"
```

### Task 22: Wire `AbilityDropdown` into the `SidePanel`

**Files:**
- Modify: `frontend/src/app/calc/page.tsx`

- [ ] **Step 1: Import**

In `frontend/src/app/calc/page.tsx`, add:

```ts
import AbilityDropdown from '@/components/AbilityDropdown';
```

- [ ] **Step 2: Add `setAbility` helper inside `SidePanel`**

In the `SidePanel` function (around line 333), alongside the existing setters (`setNat`, `setItem`, etc.), add:

```ts
const setAbility = (a: string | null) => dispatch(
  side === 'attacker'
    ? { type: 'SET_ATTACKER_ABILITY', abilityId: a }
    : { type: 'SET_DEFENDER_ABILITY', abilityId: a },
);
```

- [ ] **Step 3: Place the dropdown**

In the JSX where `NatureDropdown` and `ItemDropdown` sit:

```tsx
<div className="flex items-center gap-2 flex-wrap">
  <NatureDropdown value={cfg.nature} onChange={setNat} />
  <ItemDropdown value={cfg.itemId} onChange={setItem} />
  <AbilityDropdown value={cfg.abilityId} onChange={setAbility} speciesAbilities={detail.abilities} />
</div>
```

The existing wrapper `div` may already have `flex-wrap`; if so, just add the new dropdown after `ItemDropdown`. If the wrapper has only `flex` without `flex-wrap`, add `flex-wrap` so the third dropdown wraps cleanly on narrow widths.

- [ ] **Step 4: Verify type-check + tests**

From `frontend/`:
```
npx tsc --noEmit
npm test -- --run
```
Expected: clean.

- [ ] **Step 5: Smoke-check the dev UI**

Start the dev server (`make dev-frontend` from repo root or `npm run dev` from `frontend/`). Open `http://localhost:3000/calc`, pick Sylveon as attacker, choose Pixilate from the dropdown, set move to Hyper Voice, defender to Goodra (Dragon). Damage card shows non-zero value. Toggle Mold Breaker on Excadrill attacker vs Levitate defender — Earthquake goes from 0 to non-zero.

- [ ] **Step 6: Commit**

```
git add frontend/src/app/calc/page.tsx
git commit -m "Wire AbilityDropdown into calc SidePanel"
```

### Task 23: Calc page smoke test for ability selection

**Files:**
- Modify: `frontend/src/app/calc/__tests__/calc-page.test.tsx`

The existing file uses `vi.mock('@/lib/api', ...)` with module-level mock fixtures (defender is Dragon/Ground, only Earthquake in the moves list). We'll exercise the Mold Breaker + Levitate path because it works with the existing fixtures: defender at Levitate makes Earthquake do 0; flipping the attacker's ability to Mold Breaker makes Earthquake hit again.

- [ ] **Step 1: Append the smoke test**

Append inside the `describe('CalcPage smoke', ...)` block in `frontend/src/app/calc/__tests__/calc-page.test.tsx`:

```tsx
  it('Mold Breaker on attacker neutralizes Levitate on defender', async () => {
    render(<LocaleProvider><CalcPage /></LocaleProvider>);
    await waitFor(() => expect(screen.getAllByText('Mon 94').length).toBeGreaterThan(0));

    // Pick Earthquake into slot 1 so a result renders.
    await userEvent.click(screen.getAllByText(/tap to add/i)[0]);
    await userEvent.click(screen.getByText('Earthquake'));
    await waitFor(() => expect(screen.getAllByText(/^\d+(?:\.\d+)?%/).length).toBeGreaterThan(0));

    // Two ability dropdowns on the page (attacker, defender). Find them by aria-label.
    const abilityDropdowns = screen.getAllByLabelText('Ability') as HTMLSelectElement[];
    expect(abilityDropdowns).toHaveLength(2);
    const [attackerAbility, defenderAbility] = abilityDropdowns;

    // Set defender ability to Levitate; damage should drop to 0%.
    await userEvent.selectOptions(defenderAbility, 'levitate');
    await waitFor(() => {
      const pcts = screen.getAllByText(/^\d+(?:\.\d+)?%/);
      // Every visible damage range starts with 0.
      const firstPct = pcts[0].textContent ?? '';
      expect(firstPct.startsWith('0')).toBe(true);
    });

    // Now set attacker ability to Mold Breaker; damage should be > 0 again.
    await userEvent.selectOptions(attackerAbility, 'mold-breaker');
    await waitFor(() => {
      const firstPct = screen.getAllByText(/^\d+(?:\.\d+)?%/)[0].textContent ?? '';
      expect(firstPct.startsWith('0')).toBe(false);
    });
  });
```

- [ ] **Step 2: Run tests**

```
npm test -- calc-page --run
```
Expected: existing tests pass, new test passes.

- [ ] **Step 3: Commit**

```
git add frontend/src/app/calc/__tests__/calc-page.test.tsx
git commit -m "Add Mold Breaker / Levitate smoke test for /calc"
```

---

# Phase 6 — Verification

### Task 24: Full test sweep + lint

**Files:** none (verification).

- [ ] **Step 1: Backend tests + clippy**

From `backend/`:
```
cargo test
cargo clippy -- -D warnings
```
Expected: all tests pass; no warnings.

- [ ] **Step 2: Frontend tests + lint**

From `frontend/`:
```
npm test -- --run
npm run lint
```
Expected: 63 pre-existing tests + every new test added in this plan all pass; no lint errors.

- [ ] **Step 3: Verify the API still serves `flags`**

```
curl -s 'http://localhost:3001/api/v1/moves' | jq '.[0].flags'
```
Expected: a JSON array (possibly empty for moves like Splash; non-empty for Ice Punch / Body Slam / etc.).

- [ ] **Step 4: Final manual UI sweep**

Open `http://localhost:3000/calc` in a browser. Verify:
- Attacker and defender each have an Ability dropdown.
- Default is "No ability"; calc results match what they would without ability fields.
- Pixilate Sylveon Hyper Voice vs Goodra (Dragon) — non-zero damage card.
- Mold Breaker Excadrill EQ vs Levitate Eelektross (or any Levitate Pokémon) — non-zero damage card.
- Switching locale (en/ja/zh) re-labels every ability option.

- [ ] **Step 5: Done — push branch (if requested by user)**

This plan does not push automatically. If the user asks to open a PR, follow the standard PR workflow.

---

## Risk + rollout notes

- **Backwards compatibility**: every new code path is gated on `abilityId !== null` (frontend) or `flags` defaulting to empty (backend `#[serde(default)]`). Existing serialized URLs missing `ab` deserialize to `null`. Old Redis `MoveSummary` payloads missing `flags` deserialize to `[]` — but seed runs before the API restart in Task 5, so this is belt-and-suspenders.
- **Required ops**: Task 5 re-seeds Redis and restarts the API per CLAUDE.md.
- **Bundle B leaves clean seams**: `weather: WeatherKind | null` will live on `CalcState` (battlefield-level, not per-side); weather-conditional ability fields will be additive to the same flat-field shape; Weather Ball will get its own special case in the move-type/power resolution step, where Pixilate already lives.
