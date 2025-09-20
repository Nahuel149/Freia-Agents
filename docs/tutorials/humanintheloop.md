# Human In The Loop

In the previous tutorials, we explored how an Agent can dynamically use tools to answer queries or complete assigned tasks. **Human-in-the-loop** adds a layer of control by allowing the Agent to request human input, approval, or feedback before proceeding.

There are 2 ways human in the loop can be used:

* Using [Human Input](https://docs.flowiseai.com/using-flowise/agentflowv2#id-11.-human-input-node) node to halt the execution
* Enable **Require Human Input** for Agent's tools

## Human Input Node

The **Human Input** node allows execution to be paused and only resumed after a human has provided feedback to either approve or reject the action.

In this tutorial, we’ll learn how to create an automated email reply agent that asks for user feedback before sending out the email.

### Overview

The goal of this use case is to create an intelligent email reply system that:

1. Receives incoming email inquiries
2. Generates professional email responses using AI
3. Requests human approval before sending
4. Allows for revisions and improvements
5. Automatically sends the approved email

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FMEJcYpbwlkDxJEF8WA8j%2Fimage.png?alt=media&#x26;token=56179a99-b2a8-4baf-bbf2-0230bc0b825e" alt=""><figcaption></figcaption></figure>

#### Step 1: Setting up the Start Node

1. Drag and drop the **Start** node onto the canvas. This will be the entry point for incoming email data.
2. Configure the Start node with the following settings:
   * **Input Type**: Select "Form Input" to capture structured email data
   * **Form Title**: "Email Inquiry"
   * **Form Description**: "Incoming email inquiry"
3. Add the following Form Input Types:
   * **Subject** (String): To capture the email subject line
   * **Body** (String): To capture the email content
   * **From** (String): To capture the sender's email address

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FdPemElbUyrJUi8gDL0rj%2Fimage.png?alt=media&#x26;token=9039e00c-06bf-4353-b45f-de5f7ab64b4e" alt="" width="398"><figcaption></figcaption></figure>

#### Step 2: Creating the Email Reply Agent

1. Add an **Agent** node and connect it to the Start node. This agent will analyze the incoming email and generate an appropriate response.
2. Add system message, for example:

   ```
   You are a customer support agent working in Flowise Inc. Write a professional email reply to user's query. Use the web search tools to get more details about the prospect.

   Always reply as Samantha, Customer Support Representative in Flowise. Don't use placeholders.
   ```
3. Add the following tools to enhance the agent's capabilities:
   * **Google Custom Search**: To research customer information and provide relevant context
   * **Current DateTime**: To include accurate timestamps in responses

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FEA1rdCWBAkif7iYfRDyK%2Fimage.png?alt=media&#x26;token=2c503cb8-1499-46c2-90f9-8bc6d2c238f0" alt="" width="563"><figcaption></figcaption></figure>

#### Step 3: Adding Human Input for Approval

1. Add a **Human Input** node and connect it to the Email Reply Agent. This creates the human-in-the-loop checkpoint.
2. Configure the Human Input node:
   * **Description Type**: "Fixed"
   * **Description**: "Are you sure you want to proceed?"
   * **Enable Feedback**: True (allows humans to provide additional feedback)
3. This node will pause the workflow and present the AI-generated response to a human reviewer. The reviewer can either:
   * **Proceed**: Approve the response and continue to email sending
   * **Reject**: Send feedback and loop back to the agent for improvements

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FFZn6TtCUg5J5Jmmwpr5n%2Fimage.png?alt=media&#x26;token=5bf40b2b-2b09-4cef-98e2-8343cb16ec26" alt="" width="563"><figcaption></figcaption></figure>

#### Step 4: Setting up the Loop Back Mechanism

1. Add a **Loop** node to handle rejection scenarios. This allows the workflow to return to the Email Reply Agent for improvements.
2. Configure the Loop node:
   * **Loop Back To**: Select "Email Reply Agent" from the dropdown
   * **Max Loop Count**: 5 (prevents infinite loops)
3. Connect the "reject" output from the Human Input node to this Loop node. When a human rejects the response, the workflow will return to the agent with the feedback for improvement.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FsflNeM5kbh547rzEMsIe%2Fimage.png?alt=media&#x26;token=b098ced1-1020-44e1-bac3-6c2b7f6794ec" alt="" width="563"><figcaption></figcaption></figure>

#### Step 5: Creating the Email Subject & Body Generator

1. Add an **LLM** node and connect it to the "proceed" output of the Human Input node. This node will structure the approved response into proper email format.
2. Set up JSON Structured Output:
   * **Key**: "subject", **Type**: "string", **Description**: "Subject of the email"
   * **Key**: "body", **Type**: "string", **Description**: "Body of the email"

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fq7deu44xIwFH2GCZIPXZ%2Fimage.png?alt=media&#x26;token=0b075ee4-e853-44fc-9b79-4c740d8356e0" alt="" width="563"><figcaption></figcaption></figure>

#### Step 6: Setting up Email Sending

1. Add a **Tool** node and connect it to the Email Subject & Body LLM node. This will handle the actual email sending.
2. Configure the Tool node:
   * **Tool**: Select "Gmail" from the available tools
   * **Message Actions**: "sendMessage"
3. Configure the tool input arguments:
   * **to**: Use the variable `{{ $form.from }}` to reply to the original sender
   * **subject**: Use `{{ llmAgentflow_0.output.subject }}` to get the generated subject from Step 5
   * **body**: Use `{{ llmAgentflow_0.output.body }}` to get the generated email body from Step 5

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FihpJuApddaJM091lNwDC%2Fimage.png?alt=media&#x26;token=3f6984e4-87ae-41b1-a861-c44a2d942cb8" alt="" width="563"><figcaption></figcaption></figure>

### How the Workflow Operates

When an email inquiry comes in, here's what happens:

1. **Form Input**: The system captures the email subject, body, and sender information
2. **AI Analysis**: The Email Reply Agent analyzes the inquiry and generates a professional response using web search for additional context
3. **Human Review**: The workflow pauses and presents the AI-generated response to a human reviewer
4. **Decision Point**: The human can either:
   * **Approve**: The response proceeds to email formatting and sending
   * **Reject**: The response returns to the agent with feedback for improvement
5. **Email Formatting**: If approved, the response is structured into proper email format with subject and body
6. **Email Sending**: The final email is automatically sent via Gmail to the original sender

### Testing the Workflow

1. Start the workflow by filling out the form with a sample email inquiry

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F8mW2zt6d8Wlj9MZ17gvg%2Fimage.png?alt=media&#x26;token=a1de3219-bfe0-4810-82e5-4b76bfe20ba6" alt="" width="527"><figcaption></figcaption></figure>

2. Review the Agent response in the Human Input step

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F50DtATMNrnEFwFPzSUqI%2Fimage.png?alt=media&#x26;token=8f7801f4-2663-4eff-987d-679d957421d6" alt="" width="563"><figcaption></figcaption></figure>

3. Reject the response and provide more feedback:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FTIzDhwWFDRPWwrBzLkG2%2Fimage.png?alt=media&#x26;token=eca0f5e6-5d2b-44d8-bec3-bd33e36601b8" alt="" width="563"><figcaption></figcaption></figure>

4. Review the revised response from Agent:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FxSWCVjncJ5ESMNKAS8Rk%2Fimage.png?alt=media&#x26;token=273d0254-03cb-4cdb-99d5-e59a28d93cfc" alt="" width="563"><figcaption></figcaption></figure>

5. Proceed and verify that email is being sent correctly:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FVZVhO9elCOMtLySdyY5U%2Fimage.png?alt=media&#x26;token=8b94d3a2-eac1-40ab-93f0-290a54c73437" alt="" width="563"><figcaption></figcaption></figure>

### Complete Flow Structure

{% file src="<https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FacRwozfm4O0fS0MRd6LD%2FHuman%20In%20The%20Loop%20Agent.json?alt=media&token=82a9bf1c-c680-41c9-a992-d871a57a3c73>" %}

## Require Human Input on Agent Tools

When an Agent decides to use tools, the following happens under the hood:

1. Given a user query, the LLM determines whether tool calls are needed.
2. If tool calls are identified from LLM output response, Flowise locates the matching tools and executes the corresponding functions.
3. The results from the tool executions are returned to the LLM.
4. The LLM then decides whether additional tool calls are required or if it has enough information to return the final response.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fd1XP1OckpAqPCAXY02hx%2FUntitled-2025-06-15-0132.png?alt=media&#x26;token=b75ab8e1-c690-4bef-a8a6-f0cdddd2cd59" alt="" width="375"><figcaption></figcaption></figure>

When Require Human Input is enabled, we place an additional checkpoint after tool calls are detected:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FaZell4GrzvvhnMHpqjMW%2FUntitled-2025-06-15-0132.png?alt=media&#x26;token=69fdbe02-e69a-463a-a607-09f4f68f3b22" alt="" width="563"><figcaption></figcaption></figure>

This is crucial for sensitive tool calls such as placing orders, bookings, meetings, sending emails, etc, where you need human confirmation and review.

We can use the sample email reply system above, but simplify it to have just a single Agent.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FiHF2nFeAILCiQbrhl1w8%2Fimage.png?alt=media&#x26;token=4268b391-805d-46a1-a66d-e8f573f631e8" alt="" width="563"><figcaption></figcaption></figure>

### Configuration

1. Add an **Agent** node and connect it to the Start node. This single agent will handle both email analysis and human approval.
2. Add a system message to Agent, for example:

   ```
   You are a customer support agent working in Flowise Inc. Create a draft professional email reply to user's query. Use the web search tools to get more details about the prospect.

   Always reply as Samantha, Customer Support Representative in Flowise. Don't use placeholders.

   Today's date is {{ current_date_time }}.
   ```
3. Add the following tools:
   * **Google Custom Search**: For researching customer information
   * **Gmail**: For creating email drafts with human approval
4. Configure the Gmail tool:
   * **Gmail Type**: "drafts"
   * **Draft Actions**: "createDraft"
   * **Require Human Input**: ✅ **Enable this option** - This is the key feature that creates the HITL functionality

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FrSDRwrgdEe4xpvesazPC%2Fimage.png?alt=media&#x26;token=f53d60a1-8151-4f71-9951-7509517ddc24" alt="" width="481"><figcaption></figcaption></figure>

### How the Simplified Flow Works

1. **Form Input**: User submits email inquiry details
2. **AI Analysis**: The agent analyzes the email and uses Google Search for additional context
3. **Draft Creation**: When the agent attempts to create a Gmail draft, the workflow pauses
4. **Human Review**: The system presents the draft email for human approval
5. **Decision**: Human can approve (create draft) or reject (provide feedback and retry)

### Testing the Agent

1. Start the workflow by filling out the form with a sample email inquiry

   <figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F8mW2zt6d8Wlj9MZ17gvg%2Fimage.png?alt=media&#x26;token=a1de3219-bfe0-4810-82e5-4b76bfe20ba6" alt="" width="527"><figcaption></figcaption></figure>

2. Before the Agent creates the Gmail draft, it will ask the user for approval or rejection.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FfsMei3qTsXJvmKLwJEDk%2Fimage.png?alt=media&#x26;token=6a82c7e3-126d-4afb-8469-0de9710c8d02" alt="" width="563"><figcaption></figcaption></figure>

3. If the tool is approved, the Agent will proceed to call the tool and create the draft in Gmail. The Agent is smart enough to determine the appropriate subject, body, and recipient for the email.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FWcfcXxPk9glhkHImIVp6%2Fimage.png?alt=media&#x26;token=1a301d1c-1aa6-4bf7-8c6a-98ab3223b254" alt="" width="563"><figcaption></figcaption></figure>

### Complete Flow Structure

{% file src="<https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FPKdwgqTMFLC7jhtmoJAE%2FEmail%20Agent.json?alt=media&token=08b9e081-d8a0-4fd5-b3d5-c1b4c8bb3e7e>" %}

## Sharing Execution Traces for External Review and Approval

1. From the dashboard left side bar, click **Executions.**
2. Find the Execution trace, and click **Share.**

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FNuzgc9uLqqK2XRvqswuV%2Fimage.png?alt=media&#x26;token=7f654903-5975-40d2-bd49-65006bdb01fc" alt=""><figcaption></figcaption></figure>

3. The execution trace is now available as a public link. You can share this link with others for review.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2F7S6t2dgImcP7S4B6kTqj%2Fimage.png?alt=media&#x26;token=c307513c-b169-40dd-b9b5-2250698085fa" alt="" width="541"><figcaption></figcaption></figure>

4. Users outside of Flowise can reject or approve:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FlQT2kZAXVS281xmTHpWo%2Fimage.png?alt=media&#x26;token=016a1499-59ca-4e8b-b4db-e92a29a75d28" alt=""><figcaption></figcaption></figure>
