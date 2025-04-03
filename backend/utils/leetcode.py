import httpx

GRAPHQL_ENDPOINT = "https://leetcode.com/graphql"

async def get_problem_difficulty(slug: str):
    query = {
        "operationName": "getQuestionDetail",
        "query": """
            query getQuestionDetail($titleSlug: String!) {
                question(titleSlug: $titleSlug) {
                    questionFrontendId
                    difficulty
                }
            }
        """,
        "variables": {"titleSlug": slug}
    }

    headers = {
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        res = await client.post(GRAPHQL_ENDPOINT, json=query, headers=headers)
        if res.status_code != 200:
            return None

        data = res.json()
        q = data.get("data", {}).get("question")
        if not q:
            return None

        difficulty = q.get("difficulty")  # Easy, Medium, Hard
        number = q.get("questionFrontendId").zfill(4)
        return {
            "difficulty": difficulty,
            "number": number
        }
