# Answering "where does this come from" and "who do I ask"

Users ask about origin in several different senses, and they need different
answers. Establish which one before spending a call:

| The question really means | Answer from |
|---|---|
| "Which governed definition produced this number?" | The master item / chart already used, and the glossary term behind it. No lineage call. |
| "Which table does this field live in?" | The Data Product documentation, already cached from discovery. No lineage call. |
| "Where does the data itself originate, upstream of Qlik?" | The Data Product's own *Provenance* section if it has one; otherwise `qlik_get_lineage`. |
| "How fresh is it / when was it last loaded?" | The dataset's freshness, already cached. No lineage call. |

Most origin questions are the first two. Reach for the graph only when the
question is genuinely about upstream data flow.

## The call chain

`qlik_get_lineage` takes a **QRI**, not a dataset id.

1. **Look for the `qri` in what discovery already cached** before paying for it —
   a dataset entry from `qlik_search`, the Data Product documentation, a glossary
   term's `linksTo`. Only where none carries it does `qlik_get_dataset(datasetId)`
   earn its call.
2. `qlik_get_lineage(qri)` → one step back.
3. **Recurse on the ids the graph returned**, not on a fresh dataset lookup —
   the qri lookup is paid once, at the entry point, never per hop.

Each call returns **one hop**. Budget accordingly.

## The attribution trap — read this before recursing

**A `PROCESSOR` node — a load script, a data-prep app — is where the chain
changes nature and where precision is lost.** That is the one thing to spot in a
returned node; the rest of the graph's shape is in the tool's own description.

**The graph is resource-level, and past a `PROCESSOR` node it stops
attributing per output.**

Step back from a dataset and you reach the script that wrote it. Step back
again and you get **every input of that script** — not only the inputs that
fed the dataset you started from. A script that reads eight sources and
writes six outputs returns all eight, whichever output you started at.

So a naive recursion produces a confident, wrong answer: it will name
upstream sources that have nothing to do with the figure in question.

**What to do instead:**

- Report the first hop as fact: *this dataset is written by that
  transformation*.
- Report the second hop as **the transformation's inputs**, not as the
  dataset's sources. The wording matters: "the script that builds it reads
  from A, B and C" is true; "this dataset comes from A, B and C" may not be.
- If the question needs the precise upstream source of one dataset or one
  field, say the graph does not resolve it at that granularity, and point at
  the transformation step's own documentation or its owner.

**There is no field-level lineage.** Nothing in this tool set maps a field
back to an upstream column. Don't infer one from matching names.

## "Who should I contact about this?"

Two surfaces name a person, both already fetched during discovery: the app's
`owner` (`qlik_describe_app` returns `{id, name}` — a real name) and the Data
Product documentation's contacts, with their roles.

Nothing else resolves. A glossary term's `stewards` / `createdBy` /
`updatedBy` and a master item's `ownerId` are bare user identifiers, and this
tool set has no call that turns one into a name; sheets carry no ownership
field at all. Treat that as a plain limit: name the app or data product owner
as the contact of record, and **never infer a name from an identifier** — a
name seen elsewhere in the tenant is not evidence that it belongs to this one.

## Documented provenance and the graph answer different questions

**The graph is the source of truth for where the data comes from.** It reads what
actually ran. Nothing else in this tool set does, and a documented account is not
evidence about a pipeline — it is an account of one, written once and ageing
since.

**Documented provenance carries the business framing** the graph never does: which
system the data came from in the organization's own words, what was derived at
load time, which choices diverge from the upstream model. A glossary can add the
same kind of context, and can state business-level inferences over master items
and the data model. That is cheap — already cached — and it is what makes a
lineage answer readable.

So: **read the documentation for the framing, the graph for the fact.** Where they
disagree about what feeds what, the graph describes what runs; say the documented
account differs rather than picking one silently.

## How to phrase a lineage answer

Give the chain in the reading order the user thinks in — from the figure
back to the source — and mark where certainty stops:

> This figure comes from *[governed measure]*, computed on *[dataset]*.
> That dataset is produced by *[transformation step]*, which loads from
> *[upstream sources]*. Which of those specifically feed this dataset isn't
> resolved by the lineage graph — it stops at the transformation.

In production mode, drop the QRIs and keep the names. In verbose mode,
include the resource identifiers so the chain can be re-walked.

Never present a lineage chain as more precise than it is. "I can tell you
which transformation writes it, not which upstream column feeds this field"
is a complete and useful answer.
