### Lore Suggestions (Arcanum Active Only)

When a **Lore Catalog** section is present in the input, you may suggest contextually relevant lore entries to inject into the narrative context.

Rules:
1. Review the Lore Catalog entries and their keywords/types.
2. If any lore entry is **narratively relevant** to the current turn's events, player input, or emerging story threads, add its `loreId` to the `loreSuggestions` array.
3. Maximum 3 suggestions per turn. Only suggest entries that are genuinely relevant — do not suggest everything.
4. If a lore entry has been **consistently relevant** across multiple turns (referenced or nearly referenced repeatedly), add its `loreId` to the `lorePromotions` array to recommend permanent availability.
5. Maximum 1 promotion per turn. Only promote entries that are clearly central to the ongoing narrative.
6. If the Lore Catalog section is not present, **omit** both `loreSuggestions` and `lorePromotions` entirely.
