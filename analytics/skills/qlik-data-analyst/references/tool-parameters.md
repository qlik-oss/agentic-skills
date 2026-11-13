# Tool Parameter Examples

Tools expect a specific input parameter structure based on their specifications.
Use this examples below as a reference for how this objects need to be structured.

## Payload rules (non-negotiable)

- Send a native JSON object as tool args.
- Do not serialize arrays/objects as strings.
- Do not send pseudo-code objects such as `LimitSettings(...)`.
- Keep `sort.index` aligned with the target measure index.
- If a dimension or measure already exists as a master item, prefer `libraryId`.

## qlik_create_data_object
{
  "appId": "a5aff609-6b3c-491a-b4f0-3d33e7f6cd5f",
  "dimensions": [
    {
      "label": "RM Name",
      "libraryId": "psmqeB"
    }
  ],
  "limit": {
    "count": 10,
    "showOthers": false
  },
  "measures": [
    {
      "label": "Revenue YTD (WON)",
      "libraryId": "0647f3e6-26f7-4826-8d1b-39f8158ca7e5"
    },
    {
      "label": "Revenue Target",
      "libraryId": "47f2081f-58ee-4bdc-98ff-7baf536ffb46"
    },
    {
      "label": "Attainment (%)",
      "libraryId": "875cb7d6-20f7-4494-8b4e-0e2543f3ce61"
    },
    {
      "label": "NNM YTD (WON)",
      "libraryId": "vqDjhym"
    }
  ],
  "sort": [
    {
      "index": 3,
      "order": "desc",
      "target": "measure"
    }
  ]
}

## qlik_search (resolve app first)
{
  "query": "Demo Banking",
  "resourceType": "app",
  "limit": 10
}

## qlik_describe_app (single orientation call)
{
  "appId": "a5aff609-6b3c-491a-b4f0-3d33e7f6cd5f"
}

## qlik_select_values
{
  "appId": "a5aff609-6b3c-491a-b4f0-3d33e7f6cd5f",
  "selections": [
    {
      "field": "CalendarYear",
      "values": [
        "2026"
      ]
    }
  ]
}

## Invalid patterns (do not do this)

Bad (stringified object):
"{\"appId\":\"...\",\"limit\":{\"count\":10}}"

Bad (stringified list):
"[{\"expression\":\"Sum(Sales)\",\"label\":\"Sales\"}]"

Bad (constructor-like pseudo object):
"LimitSettings(count=10, showOthers=False)"

## Recovery checklist after tool error

1. Record exact tool name and full failed payload.
2. Confirm payload type: JSON object, not string.
3. Identify concrete root cause from the error message.
4. Change one variable at a time before retrying.
5. Stop after 2 failed retries of the same class and report blocker.