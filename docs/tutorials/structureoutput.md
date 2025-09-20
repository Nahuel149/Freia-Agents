# Structured Output

In numerous use cases, such as chatbots, models are expected to reply to users in natural language. However, there are situations where natural language responses aren’t ideal. For instance, if we need to take the model’s output, pass it as a body for HTTP request, or store into a database, it's essential that the output aligns with a predefined schema. This requirement gives rise to the concept of **structured output**, where models are guided to generate responses in a specific, structured format.

In this tutorial we are going to take a look at how to generate a structured output from LLM, and pass it as the body for HTTP request.

## Prerequisite

We are going to use the same [Event Management Server](https://docs.flowiseai.com/interacting-with-api#prerequisite) for HTTP request.

Absolutely! Here’s a tutorial for your **Structured Output Flow** in a format consistent with your "Agent as Tool" documentation, including step-by-step explanations and image placeholders.

***

## Overview

1. Receives user input through a Start node.
2. Uses an LLM to generate a structured JSON array.
3. Loops through each item in the array.
4. Sends each item via HTTP to an external endpoint.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FqFSJRt5t5K9iX73xY7Pj%2Fimage.png?alt=media&#x26;token=5a972342-97be-4f5c-badf-31372355dc62" alt=""><figcaption></figcaption></figure>

### Step 1: Setting Up the Start Node

Begin by adding a **Start** node to your canvas.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FVcrvcHICPOZtTaWXa25A%2Fimage.png?alt=media&#x26;token=5ab001ae-25f0-4677-ada6-1a3d22754830" alt="" width="417"><figcaption></figcaption></figure>

**Key Input Parameters:**

* **Input Type:**
  * `chatInput` (default): The flow starts with a chat message from the user.
  * `formInput`: The flow starts with a form (if you want to collect structured data from the user).
* **Ephemeral Memory:**
  * (Optional) If enabled, the flow does not retain chat history between runs.
* **Flow State:**
  * (Optional) Pre-populate state variables.
  * Example:

    ```json
    [
      { "key": "answers", "value": "" }
    ]
    ```
* **Persist State:**
  * (Optional) If enabled, the state is persisted across the same session.

### Step 2: Generating Structured Output with LLM

Add a LLM node and connect it to the Start node.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FVMRbpxueCCZ8amRgEs4v%2Fimage.png?alt=media&#x26;token=956e3209-79cb-4cfa-bdcc-7babedaf55c1" alt="" width="563"><figcaption></figcaption></figure>

**Purpose:** Uses a language model to analyze the input and generate a structured JSON array.

**Key Input Parameters:**

* **JSON Structured Output:**
  * **Key:** `answers`
  * **Type:** `JSON Array`
  * **JSON Schema:**

    ```json
    {
      "name": { "type": "string", "required": true, "description": "Name of the event" },
      "date": { "type": "string", "required": true, "description": "Date of the event" },
      "location": { "type": "string", "required": true, "description": "Location of the event" }
    }
    ```
  * **Description:** "answer to user query"
* **Update Flow State:**
  * Updates the flow state with the generated JSON output.
  * Example:

    ```json
    [
      {
        "key": "answers",
        "value": "{{ output.answers }}"
      }
    ]
    ```

### Step 3: Looping Through the JSON Array

Add an Iteration node and connect it to the output of the LLM node.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FRYWD67aBMEaKPQsMoF3c%2Fimage.png?alt=media&#x26;token=836aeb23-697a-4c9d-91c9-91f8c55e6793" alt="" width="563"><figcaption></figcaption></figure>

**Purpose:** Iterates over each item in the generated JSON array from LLM node.

**Key Input Parameters:**

* **Array Input:**

  * The array to iterate over. Set to the answers from the saved state:

  ```html
  {{ $flow.state.answers }}
  ```

  * This means the node will loop through each event in the answers array.

### Step 4: Sending Each Item via HTTP

Inside the loop, add a **HTTP** node.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FgyO8EiChMpd7D0NmKqkk%2Fimage.png?alt=media&#x26;token=9204eeac-bc46-4bfc-b9f6-cd08872fc90f" alt="" width="563"><figcaption></figcaption></figure>

**Purpose:** For each item in the array, sends an HTTP POST request to a specified endpoint (e.g., `http://localhost:5566/events`).

**Key Input Parameters:**

* **Method:**
  * `POST` (default for this use case).
* **URL:**
  * The endpoint to send data to.
  * Example:

    ```
    http://localhost:5566/events
    ```
* **Headers:**
  * (Optional) Add any required HTTP headers (e.g., for authentication).
* **Query Params:**
  * (Optional) Add any query parameters if needed.
* **Body Type:**
  * `json` (default): Sends the body as JSON.
* **Body:**
  * The data to send in the request body.
  * Set to the current item in the loop:

    ```html
    {{ $iteration }}
    ```
* **Response Type:**
  * `json` (default): Expects a JSON response.

***

## Example Interactions

**User Input:**

```
create 2 events:
1. JS Conference on next Sat in Netherlands
2. GenAI meetup, Sept 19, in Dublin
```

**Flow:**

* Start node receives the input.
* LLM node generates a JSON array of events.
* Loop node iterates through each event.
* HTTP node create each event via the API.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FkiNWE5eYLf9BjKdfejfi%2Fimage.png?alt=media&#x26;token=47f9e7ef-d233-4684-b5d8-fa7935d1513e" alt=""><figcaption></figcaption></figure>

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fa9335sUPCc7voDlV2l7q%2Fimage.png?alt=media&#x26;token=739a5f73-bb27-4e75-bf4d-f948ccc2ffda" alt=""><figcaption></figcaption></figure>

***

## Complete Flow Structure

{% file src="<https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FHxzmbWSE6dgsr3uGwELs%2FStructured%20Output.json?alt=media&token=54754e8f-4485-4d1c-8eca-cf2a9ebcfd29>" %}

***

## Best Practices

**Design Guidelines:**

1. **Clear Output Schema:** Define the expected structure for the LLM output to ensure reliable downstream processing.

**Common Use Cases:**

* **Event Processing:** Collect and send event data to a calendar or event management system.
* **Bulk Data Entry:** Generate and submit multiple records to a database or API.
* **Automated Notifications:** Send personalized messages or alerts for each item in a list.
