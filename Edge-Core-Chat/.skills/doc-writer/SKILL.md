---
name: doc-writer
description: Keep project documentation up-to-date after code changes. Use when completing features, refactoring code, adding components/hooks, or when user requests documentation update. Automatically maps changed files to relevant docs and updates README, plan, and PR files.
---

# Documentation Writer

## ⚠️ ACTIVATION NOTICE

**When this skill is activated, you MUST print to the user:**

```
📝 DOCUMENTATION WRITER SKILL ACTIVATED
```

This ensures the user knows documentation updates are being processed.

## Document Metadata

Every documentation file should include a footer at the bottom showing when it was last updated:

```markdown
---

*Last updated: 2026-01-29 | Last commit: abc1234 - feat: add chat animations*
```

To get the last commit info for a file:

```bash
git log -1 --format="%h - %s" -- docs/filename.md
```

To update timestamps after changes:

```bash
# Get current date and last commit for a specific doc
DATE=$(date +%Y-%m-%d)
COMMIT=$(git log -1 --format="%h - %s" -- docs/configuration.md)
echo "Last updated: $DATE | Last commit: $COMMIT"
```

## Self-Evaluation

After updating documentation, verify quality:

### Checklist

- [ ] Timestamps updated on modified docs
- [ ] No broken internal links
- [ ] No duplicate content
- [ ] Code examples are accurate
- [ ] TOC reflects current docs
- [ ] PR.md under 4000 chars

### Auto-Check Commands

```bash
# Check for broken links
grep -roh '\[.*\](\.\/[^)]*)\|\[.*\](docs/[^)]*)' README.md docs/ | sort -u

# Verify all linked files exist
for f in $(grep -roh 'docs/[a-z-]*\.md' README.md docs/ | sort -u); do
  [ -f "$f" ] || echo "Missing: $f"
done

# Count PR.md words
wc -w PR.md
```

## Quick Start

After making significant changes:

```bash
git diff --name-only HEAD~1
git status
```

Then update relevant docs based on this mapping:

| Changed Area           | Documentation File                         |
| ---------------------- | ------------------------------------------ |
| `src/components/Chat/` | `docs/src/chat-component.md`               |
| `src/config/`          | `docs/src/configuration.md`                |
| `src/styles/`          | `docs/src/styling.md`                      |
| `src/locales/`         | `docs/src/localization.md`                 |
| `src/hooks/`           | `docs/src/architecture.md`                 |
| `src/services/`        | `docs/src/architecture.md`                 |
| `server/`              | `server/README.md`, `docs/src/deployment.md` |
| `hooks/`               | `docs/src/3-development/deployment.md`, `infra/README.md` |
| `infra/`               | `docs/src/3-development/deployment.md`, `infra/README.md` |
| `package.json`         | `docs/src/stack.md`, `docs/src/getting-started.md` |
| `vite.config.ts`       | `docs/src/architecture.md`                 |
| `.env*`                | `docs/src/getting-started.md`, `docs/src/deployment.md` |
| Project structure      | `docs/src/architecture.md`                 |
| New features           | `docs/src/plan.md`, `README.md`            |
| Deployment changes     | `docs/src/deployment.md`                   |

### Step 3: Update Documentation

#### README.md Updates

- Keep it concise with links to detailed docs
- Update TOC if new docs added
- Update feature list if new features added
- Don't duplicate content from docs/

#### docs/plan.md Updates

- Mark completed items with ✅
- Add new planned items
- Update current status
- Note any blockers or changes in scope

#### PR.md Updates

- Summarize changes (max 4000 chars)
- List affected files
- Note any breaking changes
- Keep it factual, not aspirational

### Step 4: Validation Checklist

- [ ] No duplicate content between README and docs
- [ ] All links in README point to existing docs
- [ ] Configuration docs match actual config options
- [ ] Component docs match actual props/API
- [ ] Getting started instructions actually work
- [ ] Plan reflects current state accurately

## Documentation Principles

### Single Source of Truth

- Each piece of information lives in ONE place
- README links to docs, doesn't duplicate
- If info exists in code (config, types), reference don't copy

### Accuracy Over Completeness

- Only document what's actually implemented
- Mark planned features clearly as "Planned"
- Don't document aspirational features as done

### Keep It Current

- Update docs in same PR as code changes
- Remove docs for removed features
- Update examples when API changes

## File Structure

```
docs/
├── .vitepress/
│   └── config.ts         # VitePress site configuration
├── src/                  # Markdown documentation files
│   ├── index.md          # Homepage (VitePress)
│   ├── getting-started.md    # Installation, setup, quick start
│   ├── configuration.md      # All config options with examples
│   ├── chat-component.md     # Chat component API and usage
│   ├── styling.md            # Theming, customization, CSS
│   ├── localization.md       # i18n setup and adding languages
│   ├── architecture.md       # Project structure, patterns, hooks
│   ├── stack.md              # Tech stack, dependencies, tools
│   └── plan.md               # Roadmap, status, phases
├── package.json
└── README.md

.skills/
└── doc-writer/
    └── SKILL.md          # This file
```

## Example Update Flow

After adding a new config option:

1. **Check the change:**

   ```bash
   git diff src/config/constants.ts
   ```

2. **Update configuration.md:**
   - Add new option to table
   - Add usage example
   - Note default value

3. **Update README if needed:**
   - Only if it's a major feature worth highlighting

4. **Update plan.md:**
   - Mark related task as complete if applicable

## Anti-Patterns to Avoid

❌ **Don't** copy-paste code into docs (reference files instead)
❌ **Don't** document unimplemented features as done
❌ **Don't** duplicate content across multiple docs
❌ **Don't** use vague language ("will support", "planning to")
❌ **Don't** forget to update TOC when adding docs
❌ **Don't** leave broken internal links

## Commands Reference

```bash
# See what needs documenting
git diff --name-only HEAD~1

# Check if docs are in sync
grep -r "TODO" docs/

# Find broken internal links
grep -rh "\](\./" docs/ README.md | grep -v "^#"

# Word count for PR.md (max 4000)
wc -w PR.md
```

## Self-Update

This skill can update itself when documentation patterns change:

1. **When to update this skill:**
   - New documentation files added to docs/
   - New mapping patterns discovered
   - Better validation commands found

2. **How to update:**
   ```bash
   # Edit this skill file
   view .skills/doc-writer/SKILL.md
   
   # Update the mapping table if new patterns found
   # Update commands if better alternatives exist
   # Add new anti-patterns learned
   ```

3. **After updating skill:**
   - Update the Last Updated timestamp in this file
   - Test the new commands work
   - Verify the mapping table is complete

## Creating New Docs

When a new area needs documentation:

1. Create the doc file:
   ```bash
   touch docs/src/new-feature.md
   ```

2. Add content with footer:
   ```markdown
   # New Feature
   
   ## Overview
   ...
   
   ---
   
   *Last updated: YYYY-MM-DD | Last commit: <will be filled on first commit>*
   ```

3. Add to VitePress sidebar in `docs/.vitepress/config.ts`
4. Update README.md TOC
5. Update this skill's mapping table if needed
