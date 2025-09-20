# Agentic RAG

Agentic RAG is an agent based approach to perform [RAG](https://docs.flowiseai.com/tutorials/rag) in an orchestrated fashion. It may involve retrieving data from various document sources, comparing summaries, and implementing an automatic self-correction mechanism.

In this tutorial, we'll explore how to build a self-correcting RAG system that checks the relevance of retrieved data and automatically re-generates the query if the results are not relevant.

## Overview

The Agentic RAG flow implements a multi-step process that:

1. Validates and categorizes incoming queries
2. Generates optimized search queries for vector database retrieval
3. Evaluates the relevance of retrieved documents
4. Self-corrects by regenerating queries when results are not relevant
5. Provides contextual responses based on retrieved information

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FvqsOL3lc2hKQ2rq5IZpW%2Fimage.png?alt=media&#x26;token=8b3121f8-836a-494c-a881-5f5c9ee96102" alt=""><figcaption></figcaption></figure>

### Step 1: Setting Up the Start Node

Begin by adding a **Start** node to your canvas. This serves as the entry point for your agent flow.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FclNwBhfrW3UQGc1ZJg9X%2Fimage.png?alt=media&#x26;token=e85d6037-7213-473a-97f8-ba5d9d35002a" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Input Type**: Select "Chat Input" to accept user questions
* **Flow State**: Add a state variable with key "`query`" and empty value

The Start node initializes the flow state with an empty `query` variable that will be updated throughout the process.

### Step 2: Adding Query Validation

Add a **Condition Agent** node and connect it to the Start node.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F5nbzNPU9HjkKqqvRIgzg%2Fimage.png?alt=media&#x26;token=aba5cb35-8867-4e7d-978e-47df80d72d4f" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Instructions**: "Check if user is asking about AI related topic, or just general query"
* **Input**: `{{ question }}` (references the user's input)
* **Scenarios**:
  * Scenario 1: "AI Related"
  * Scenario 2: "General"

This node acts as a router, determining whether the query requires specialized AI knowledge or can be answered generally.

### Step 3: Creating the General Response Branch

For non-AI related queries, add an **LLM** node connected to output 1 of the condition agent.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fc9WxZLczEqSgCChmnIcB%2Fimage.png?alt=media&#x26;token=fd64b89b-d725-4a76-961c-39f62345098e" alt="" width="375"><figcaption></figcaption></figure>

This provides direct responses for general queries without requiring document retrieval. You can also replace with Direct Reply node to return a predefined answer.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FcyvLKdsTd5JShZkSqQih%2Fimage.png?alt=media&#x26;token=f0a107a2-6f1c-4acf-a431-d264c73eaf62" alt="" width="375"><figcaption></figcaption></figure>

### Step 4: Setting Up Query Generation

For AI-related queries, add an **LLM** node connected to output 0 of the condition agent - which is the scenario for "AI-related".

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FmKCbndWjfGdiBiO40X7R%2Fimage.png?alt=media&#x26;token=c0022be2-0829-4bb3-90bc-3ebe59d5a8ee" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Messages**: Add a system message:

  ```
  Given the user question and history, construct a short string that can be used for searching vector database. Only generate the query, no meta comments, no explanation

  Example:
  Question: what are the events happening today?
  Query: today's event

  Example:
  Question: how about the address?
  Query: business address of the shop

  Question: {{ question }}
  Query:
  ```
* **Update Flow State**: Set key "query" with value `{{ output }}`. This will update the value of "query" to the output from this LLM node.

This node transforms the user's natural language question into an optimized search query for the vector database.

### Step 5: Configuring the Vector Database Retriever

Add a **Retriever** node and connect it to the "Generate Query" LLM.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FRnaKLAqslvE27YJhSBxR%2Fimage.png?alt=media&#x26;token=9acfba47-5082-4c1c-af05-5fef64297b67" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Knowledge (Document Stores)**: Select your pre-configured document store (e.g., "ai paper")
* **Retriever Query**: `{{ $flow.state.query }}` (uses the "query" value from shared state)

This node searches your vector database using the optimized query and returns relevant documents.

### Step 6: Adding Document Relevance Check

Add another **Condition Agent** node connected to the Retriever.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FIHJUfz96RlLvmHbtzHjl%2Fimage.png?alt=media&#x26;token=be5216ab-f020-4a03-bec2-97c045b0dc45" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Instructions**: "Determine if the document is relevant to user question. User question is {{ question }}"
* **Input**: `{{ retrieverAgentflow_0 }}` (references the retrieved documents from Step 5)
* **Scenarios**:
  * Scenario 1: "Relevant"
  * Scenario 2: "Irrelevant"

This evaluates whether the retrieved documents actually contain information relevant to the user's question.

### Step 7: Creating the Final Response Generator

For relevant documents, add an **LLM** node connected to output 0 of the relevance checker - which is when the scenario "Relevant" is matched.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F5IhYxS2j7c2sSG1sbGlq%2Fimage.png?alt=media&#x26;token=5ec28dfe-17c8-47e5-b4bf-e3df39f42f46" alt="" width="373"><figcaption></figcaption></figure>

#### Configuration:

* **Input Message**:

  ```
  Given the question: {{ question }}
  And the findings: {{ retrieverAgentflow_0 }}
  Output the final response
  ```

This node creates the final answer by combining the user's question with the relevant retrieved documents.

### Step 8: Implementing Self-Correction

For irrelevant documents, add an **LLM** node connected to output 1 of the relevance checker - for the second scenario - "Irrelevant".

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FUNpkdP6DJShA0056xAdF%2Fimage.png?alt=media&#x26;token=0ddb3fff-1d26-4c35-8e3f-ef303d0aa642" alt="" width="375"><figcaption></figcaption></figure>

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F5UuKfRX4ZDGNdw1zcLr7%2Fimage.png?alt=media&#x26;token=6d53987f-c664-46d9-b852-628ce562fc98" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Messages**: Add system message: "You are a helpful assistant that can transform the query to produce a better question."
* **Input Message**:

  ```
  Look at the input and try to reason about the underlying semantic intent / meaning.
  Here is the initial question: {{ $flow.state.query }}
  Formulate an improved question:
  ```
* **Update Flow State**: Set key "query" with value `{{ output }}`

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FFPmge0juVqEkZbe8rvlF%2Fimage.png?alt=media&#x26;token=b464f30d-2315-4743-8444-89e1974a419d" alt="" width="520"><figcaption></figcaption></figure>

This node analyzes why the initial query didn't return relevant results and generates an improved version.

### Step 9: Adding the Loop Back Mechanism

Add a **Loop** node connected to the "Regenerate Question" LLM.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FujOZZjSPqcnrrb2t5knK%2Fimage.png?alt=media&#x26;token=a5a2d250-f5a9-498c-8664-2c021ae262b4" alt="" width="563"><figcaption></figcaption></figure>

#### Configuration:

* **Loop Back To**: Select "retrieverAgentflow\_0-Retriever Vector DB"
* **Max Loop Count**: Set to 5 (prevents infinite loops)

This creates a feedback loop that allows the system to retry with improved queries when initial results are not satisfactory.

## Complete Flow Structure

{% file src="<https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fikpdnn7lUrpsLQ9gMoGo%2FAgentic%20RAG%20V2.json?alt=media&token=82867a50-4e10-4eed-bff8-58c88fe9617b>" %}

## Summary

1. Start → Check if query valid
2. Check if query valid (AI Related) → Generate Query
3. Check if query valid (General) → General Answer
4. Generate Query → Retriever Vector DB
5. Retriever Vector DB → Check if docs relevant
6. Check if docs relevant (Relevant) → Generate Response
7. Check if docs relevant (Irrelevant) → Regenerate Question
8. Regenerate Question → Loop back to Retriever

## Testing Your Flow

Test your flow with various types of questions:

* AI-related queries: "What are the latest developments in machine learning?"
* General queries: "What's the weather like today?"
* Complex queries that might require refinement: "How does that new technique work?"

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FQQsfZTNDDUUiGc0DN6hN%2Fimage.png?alt=media&#x26;token=f43da0be-046a-4b77-aa91-10c868ce13bc" alt="" width="563"><figcaption></figcaption></figure>

This Agentic RAG provides a robust, self-improving system for document-based question answering that can handle both simple and complex queries while maintaining high accuracy through iterative refinement.
