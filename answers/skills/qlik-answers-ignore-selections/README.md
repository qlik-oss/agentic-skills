# qlik-answers-ignore-selections

A calculation skill for Qlik Answers. Every answer is calculated on all the data in the app, so selections the user left active on their sheets don't change the result. Filters the user states in the question still apply. To use their selections, the user asks for it in the question ("within my current selection").

It writes every aggregation with the set identifier `1`, rewrites master measures the same way, and avoids `=` searches inside set modifiers, because those bring the selections back.

**Example**

Selection active: Brand = Tesla.

User: "What are total sales?"

Answer: total sales for all brands, not only Tesla, followed by "Calculated on all data. Your current selections were not applied."
