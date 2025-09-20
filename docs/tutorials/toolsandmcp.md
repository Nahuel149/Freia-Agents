# Tools & MCP

In the previous [**Interacting with API**](https://docs.flowiseai.com/tutorials/interacting-with-api) tutorial, we explored how to enable LLMs to call external APIs. To enhance the user experience, Flowise provides a list of prebuilt tools. Refer to the [**Tools**](https://docs.flowiseai.com/integrations/langchain/tools) section for the full list of available integrations.

In cases where the tool you need is not yet available, you can create a **Custom Tool** to suit your requirements.

## Custom Tool

We are going to use the same [Event Management Server](https://docs.flowiseai.com/interacting-with-api#prerequisite), and create a custom tool which can call the HTTP POST request for `/events`.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgi0j3kQWXPetFELbztEX%2Fimage.png?alt=media&#x26;token=202a6090-d6ba-4334-b4ed-c803cc48f400" alt="" width="563"><figcaption></figcaption></figure>

* **Tool Name:** `create_event`
* **Tool Description:** `Use this when you want to create a new event.`
* **Input Schema:** A JSON schema of the API request body which allows LLM to know how to automatically generate the correct JSON body. For instance:
* **Javascript Function**: The actual function to execute once this tool is called

```javascript
const fetch = require('node-fetch');
const url = 'http://localhost:5566/events';
const options = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: $name,
      location: $location,
      date: $date
    })
};
try {
    const response = await fetch(url, options);
    const text = await response.text();
    return text;
} catch (error) {
    console.error(error);
    return '';
}
```

### How to use function:

* You can use any libraries imported in Flowise.
* You can use properties specified in Input Schema as variables with prefix `$`:
  * Property from Input Schema = `name`
  * Variable to be used in Function = `$name`
* You can get default flow config:
  * `$flow.sessionId`
  * `$flow.chatId`
  * `$flow.chatflowId`
  * `$flow.input`
  * `$flow.state`
* You can get custom variables: `$vars.<variable-name>`
* Must return a string value at the end of function

### Use custom tool on Agent

After custom tool has been created, you can use it on the Agent node.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FOBE95iwqSzyrg85Fnv4b%2Fimage.png?alt=media&#x26;token=e22b369d-948e-486d-800a-ef6e42e751e1" alt="" width="341"><figcaption></figcaption></figure>

From the Tool dropdown, select the custom tool. You can also turn on **Return Direc**t if you want to directly return the output from custom tool.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FeBxlIiPEOHrt0Wj6PF2L%2Fimage.png?alt=media&#x26;token=e106d7d3-b48c-4ee4-87ab-d77a24b37f54" alt="" width="392"><figcaption></figcaption></figure>

### Use custom tool on Tool

It can also be used as a Tool Node in a determined workflow scenario.\
In this case, **Tool Input Arguments must be explicitly defined and filled with values**, because there is no LLM to automatically determine the values.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FRQK8NkxstQpZQvIHFkTV%2Fimage.png?alt=media&#x26;token=6c2af92e-a5e3-4c9d-948d-6fc1d8b23f66" alt="" width="563"><figcaption></figcaption></figure>

## MCP

MCP ([Model Context Protocol](https://modelcontextprotocol.io/introduction)) provides a standardized way to connect AI models to different data sources and tools. In other words, instead of relying on Flowise built in tools or creating custom tool, one can uses MCP servers that have been created by others. MCP is widely considered an industry standard and is typically supported and maintained by the official providers. For example, the GitHub MCP is developed and maintained by the GitHub team, with similar support provided for Atlassian Jira, Brave Search, and others. You can find the list of supported servers [here](https://modelcontextprotocol.io/examples).

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fadd4wQUfHD4Ld0u2M0pm%2Fimage.png?alt=media&#x26;token=f5c3cd00-5e8f-4a3f-b4bd-c0e5b1bd4866" alt="" width="413"><figcaption></figcaption></figure>

## Custom MCP

Apart from the prebuilt MCP tools, the most powerful feature is **Custom MCP**, which allows users to connect to any MCP server of their choice.

MCP follows a client-server architecture where:

* **Hosts** are LLM applications (like Flowise) that initiate connections
* **Clients** maintain 1:1 connections with servers, inside the host application (like Custom MCP)
* **Servers** provide context, tools, and prompts to clients (example [servers](https://modelcontextprotocol.io/examples))

To handle the actual communication between clients and servers. MCP supports multiple transport mechanisms:

1. **Stdio transport**
   * Uses standard input/output for communication
   * Ideal for local processes
2. **Streamable HTTP transport**
   * Uses HTTP with optional Server-Sent Events for streaming
   * HTTP POST for client-to-server messages

### Stdio

Stdio transport enables communication through standard input and output streams. This is particularly useful for local integrations and command-line tools.

Only use this when using Flowise locally, not when deployed to cloud services. This is because running command like `npx` will install the MCP server package (ex: `@modelcontextprotocol/server-sequential-thinking`)  locally, and it often takes long time for that.&#x20;

It is more suited for desktop application like Claude Desktop, VS Code etc.

#### **NPX command**

```json
{
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-sequential-thinking"
  ]
}
```

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FqLEeY1dYdQqeBQtA2yue%2Fimage.png?alt=media&#x26;token=01d53f99-534e-4a6d-9e2b-137a77d5d99c" alt="" width="419"><figcaption></figcaption></figure>

For Windows, refer to this [guide](https://gist.github.com/feveromo/7a340d7795fca1ccd535a5802b976e1f).

#### **Docker command**

The Docker command is suitable when the machine running Flowise also has access to Docker. However, it is not suitable for deployments on cloud services where Docker access is restricted or unavailable.

```json
{
  "command": "docker",
  "args": [
    "run",
    "-i",
    "--rm",
    "mcp/sequentialthinking"
  ]
}
```

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FMptFG2gNvqiwuoscua9Y%2Fimage.png?alt=media&#x26;token=ae3e4563-d534-4069-a039-fa8d356cd582" alt="" width="416"><figcaption></figcaption></figure>

Docker provides a list of MCP servers, which can be found [here](https://hub.docker.com/catalogs/mcp). Here's how it works:

1. Make sure Docker is running.
2. Locate the MCP server configuration and add it to **Custom MCP**. For example: <https://hub.docker.com/r/mcp/sequentialthinking>
3. Refresh the **Available Actions**. If the image is not found locally, Docker will automatically pull the latest image. Once the image is pulled, you will see the list of available actions.

```
Unable to find image 'mcp/sequentialthinking:latest' locally
latest: Pulling from mcp/sequentialthinking
f18232174bc9: Already exists
cb2bde55f71f: Pull complete
9d0e0719fbe0: Pull complete
6f063dbd7a5d: Pull complete
93a0fbe48c24: Pull complete
e2e59f8d7891: Pull complete
96ec0bda7033: Pull complete
4f4fb700ef54: Pull complete
d0900e07408c: Pull complete
Digest: sha256:cd3174b2ecf37738654cf7671fb1b719a225c40a78274817da00c4241f465e5f
Status: Downloaded newer image for mcp/sequentialthinking:latest
Sequential Thinking MCP Server running on stdio
```

#### When to use

* Building command-line tools
* Implementing local integrations
* Needing simple process communication
* Working with shell scripts

### Streamable HTTP (Recommended)

We will use Github Remote MCP as an example. The beautiful part of [Remote GitHub MCP server](https://github.com/github/github-mcp-server), you don’t need to install or run it locally, new updates are applied automatically.

#### Step 1: Create a variable for Github PAT

In order to access the MCP server, we need to create a Personal Access Token from Github. Refer to [guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic). Once PAT has been created, create a variable to store the token. This variable will be used in Custom MCP.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FuAvmqxt2P9VXajZs8bwy%2Fimage.png?alt=media&#x26;token=94838523-1c12-4e89-bfb1-faaa2429f699" alt="" width="508"><figcaption></figcaption></figure>

#### Step 2: Create Custom MCP

Create an Agent node, and add a new Custom MCP tool. For streamable HTTP, we just need to put in the URL and other necessary headers. You can use [variables](https://docs.flowiseai.com/using-flowise/variables) in the MCP Server Config with double curly braces `{{ }}` and prefix `$vars.<variableName>`.

```json
{
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": {
    "Authorization": "Bearer {{$vars.githubPAT}}",
  }
}
```

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FMKQ3PimASDCcuaSpJIdG%2Fimage.png?alt=media&#x26;token=ebd9b9a3-e15c-4086-8069-cd505889ff10" alt="" width="414"><figcaption></figcaption></figure>

#### Step 3: Select the actions

If the MCP server configuration is working correctly, you can refresh the **Available Actions**, and Flowise will automatically pull in all available actions from the MCP server.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FbDhCtPymuUq1zlOkAkgt%2Fimage.png?alt=media&#x26;token=d0062a3d-f6e6-400f-82fb-8deed4dcbc66" alt="" width="359"><figcaption></figcaption></figure>

#### Example Interactions:

> Give me the most recent issue

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FW83z4lp9GFHf3dtcQruL%2Fimage.png?alt=media&#x26;token=8dfb5125-225e-4b46-b94e-0d28cfc61f2a" alt=""><figcaption></figcaption></figure>

The agent is able to identify the appropriate actions from MCP and use them to answer the user's query.

#### When to use

Use Streamable HTTP when:

* Building web-based integrations
* Needing client-server communication over HTTP
* Requiring stateful sessions
* Supporting multiple concurrent clients
* Implementing resumable connections

## Video Tutorial

{% embed url="<https://youtu.be/7FClI-QM3tk?si=zBNEShd3NlcrOBrO>" %}
