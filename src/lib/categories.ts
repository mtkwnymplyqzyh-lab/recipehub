// Shared closed lists for category/cuisine selects (CreateRecipe) and
// filter chips (Home). Kept fixed on purpose — a free-text cuisine field
// let two users spell the same cuisine two different ways, spawning a new
// filter chip per typo/variant. Custom values are still allowed (via "אחר"
// in CreateRecipe), they're just bucketed under "אחר" for filtering rather
// than each spawning their own chip.
export const DEFAULT_CATEGORIES = ['בשרי', 'חלבי', 'טבעוני', 'צמחוני', 'קינוחים'];
export const DEFAULT_CUISINES = ['הודי', 'פרסי', 'מרוקאי', 'איטלקי', 'אסייתי'];
