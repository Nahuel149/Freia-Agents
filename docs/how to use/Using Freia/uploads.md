# Uploads

Flowise lets you upload images, audio, and other files from the chat. In this section, you'll learn how to enable and use these features.

## Image

Certain chat models allow you to input images. Always refer to the official documentation of the LLM to confirm if the model supports image input.

* [ChatOpenAI](https://docs.flowiseai.com/integrations/llamaindex/chat-models/chatopenai)
* [AzureChatOpenAI](https://docs.flowiseai.com/integrations/llamaindex/chat-models/azurechatopenai)
* [ChatAnthropic](https://docs.flowiseai.com/integrations/langchain/chat-models/chatanthropic)
* [AWSChatBedrock](https://docs.flowiseai.com/integrations/langchain/chat-models/aws-chatbedrock)
* [ChatGoogleGenerativeAI](https://docs.flowiseai.com/integrations/langchain/chat-models/google-ai)
* [ChatOllama](https://docs.flowiseai.com/integrations/llamaindex/chat-models/chatollama)
* [Google Vertex AI](https://docs.flowiseai.com/integrations/langchain/llms/googlevertex-ai)

{% hint style="warning" %}
Image processing only works with certain chains/agents in Chatflow.

[LLMChain](https://docs.flowiseai.com/integrations/langchain/chains/llm-chain), [Conversation Chain](https://docs.flowiseai.com/integrations/langchain/chains/conversation-chain), [ReAct Agent](https://docs.flowiseai.com/integrations/langchain/agents/react-agent-chat), [Conversational Agent](https://docs.flowiseai.com/integrations/langchain/agents/conversational-agent), [Tool Agent](https://docs.flowiseai.com/integrations/langchain/agents/tool-agent)
{% endhint %}

If you enable **Allow Image Upload**, you can upload images from the chat interface.

<div align="center"><figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-b3871bd9e9a44419c5661ba8117440b381e26dde%2Fimage%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1).png?alt=media" alt="" width="255"><figcaption></figcaption></figure> <figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-86ae8cbe67ed132c8e9993ffef433ed79ffd13f3%2FScreenshot%202024-02-29%20011714.png?alt=media" alt="" width="290"><figcaption></figcaption></figure></div>

To upload images with the API:

{% tabs %}
{% tab title="Python" %}

```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "question": "Can you describe the image?",
    "uploads": [
        {
            "data": "data:image/png;base64,iVBORw0KGgdM2uN0", # base64 string or url
            "type": "file", # file | url
            "name": "Flowise.png",
            "mime": "image/png"
        }
    ]
})
```

{% endtab %}

{% tab title="Javascript" %}

```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "Can you describe the image?",
    "uploads": [
        {
            "data": "data:image/png;base64,iVBORw0KGgdM2uN0", //base64 string or url
            "type": "file", // file | url
            "name": "Flowise.png",
            "mime": "image/png"
        }
    ]
}).then((response) => {
    console.log(response);
});
```

{% endtab %}
{% endtabs %}

## Audio

In the Chatflow Configuration, you can select a speech-to-text module. Supported integrations include:

* OpenAI
* AssemblyAI
* [LocalAI](https://docs.flowiseai.com/integrations/langchain/chat-models/chatlocalai)

When this is enabled, users can speak directly into the microphone. Their speech is be transcribed into text.

<div align="left"><figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-0dd60a403ed7dcb5d2c52af7f222ad3bdb228c5f%2Fimage%20(2)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1).png?alt=media" alt="" width="563"><figcaption></figcaption></figure> <figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-836d8aaf00689baaf5b4e5bb59adf9a6e8ef558b%2FScreenshot%202024-02-29%20012538.png?alt=media" alt="" width="431"><figcaption></figcaption></figure></div>

To upload audio with the API:

{% tabs %}
{% tab title="Python" %}

```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "uploads": [
        {
            "data": "data:audio/webm;codecs=opus;base64,GkXf", # base64 string
            "type": "audio",
            "name": "audio.wav",
            "mime": "audio/webm"
        }
    ]
})
```

{% endtab %}

{% tab title="Javascript" %}

```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "uploads": [
        {
            "data": "data:audio/webm;codecs=opus;base64,GkXf", // base64 string
            "type": "audio",
            "name": "audio.wav",
            "mime": "audio/webm"
        }
    ]
}).then((response) => {
    console.log(response);
});
```

{% endtab %}
{% endtabs %}

## Files

You can upload files in two ways:

* Retrieval augmented generation (RAG) file uploads
* Full file uploads

When both options are on, full file uploads take precedence.

### RAG File Uploads

You can upsert uploaded files on the fly to the vector store. To enable file uploads, make sure you meet these prerequisites:

* You must include a vector store that supports file uploads in the chatflow.
  * [Pinecone](https://docs.flowiseai.com/integrations/langchain/vector-stores/pinecone)
  * [Milvus](https://docs.flowiseai.com/integrations/langchain/vector-stores/milvus)
  * [Postgres](https://docs.flowiseai.com/integrations/langchain/vector-stores/postgres)
  * [Qdrant](https://docs.flowiseai.com/integrations/langchain/vector-stores/qdrant)
  * [Upstash](https://docs.flowiseai.com/integrations/langchain/vector-stores/upstash-vector)
* If you have multiple vector stores in a chatflow, you can only turn on file upload for one vector store at a time.
* You must connect at least one document loader node to the vector store's document input.
* Supported document loaders:
  * [CSV File](https://docs.flowiseai.com/integrations/langchain/document-loaders/csv-file)
  * [Docx File](https://docs.flowiseai.com/integrations/langchain/document-loaders/docx-file)
  * [Json File](https://docs.flowiseai.com/integrations/langchain/document-loaders/json-file)
  * [Json Lines File](https://docs.flowiseai.com/using-flowise/broken-reference)
  * [PDF File](https://docs.flowiseai.com/integrations/langchain/document-loaders/pdf-file)
  * [Text File](https://docs.flowiseai.com/integrations/langchain/document-loaders/text-file)
  * [Unstructured File](https://docs.flowiseai.com/integrations/langchain/document-loaders/unstructured-file-loader)

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-83628ae5924a794dbe7e9c823538ca03d4f11e41%2Fimage%20(2)%20(1)%20(1)%20(1)%20(1)%20(1)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

You can upload one or more files in the chat:

<div align="left"><figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-02226006c1f836ca7934fb52a548d2794d8e66d5%2Fimage%20(3)%20(1)%20(1)%20(1).png?alt=media" alt="" width="380"><figcaption></figcaption></figure> <figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-d92144a8c957b00f956b178a680b22ef99af05ec%2FScreenshot%202024-08-26%20170456.png?alt=media" alt=""><figcaption></figcaption></figure></div>

Here's how it works:

1. The metadata for uploaded files is updated with the chatId.
2. This associates the file with the chatId.
3. When querying, an **OR** filter applies:

* Metadata contains `flowise_chatId`, and the value is the current chat session ID
* Metadata does not contain `flowise_chatId`

An example of a vector embedding upserted on Pinecone:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-3578f9e1c0aa67fc818f80455cbdf61a106049f9%2Fimage%20(4)%20(1)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

To do this with the API, follow these two steps:

1. Use the [Vector Upsert API](https://docs.flowiseai.com/using-flowise/broken-reference) with `formData` and `chatId`:

{% tabs %}
{% tab title="Python" %}

```python
import requests

API_URL = "http://localhost:3000/api/v1/vector/upsert/<chatflowid>"

# Use form data to upload files
form_data = {
    "files": ("state_of_the_union.txt", open("state_of_the_union.txt", "rb"))
}

body_data = {
    "chatId": "some-session-id"
}

def query(form_data):
    response = requests.post(API_URL, files=form_data, data=body_data)
    print(response)
    return response.json()

output = query(form_data)
print(output)
```

{% endtab %}

{% tab title="Javascript" %}

```javascript
// Use FormData to upload files
let formData = new FormData();
formData.append("files", input.files[0]);
formData.append("chatId", "some-session-id");

async function query(formData) {
    const response = await fetch(
        "http://localhost:3000/api/v1/vector/upsert/<chatflowid>",
        {
            method: "POST",
            body: formData
        }
    );
    const result = await response.json();
    return result;
}

query(formData).then((response) => {
    console.log(response);
});
```

{% endtab %}
{% endtabs %}

2. Use the [Prediction API](https://docs.flowiseai.com/using-flowise/broken-reference) with `uploads` and the `chatId` from step 1:

{% tabs %}
{% tab title="Python" %}

```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "question": "What is the speech about?",
    "chatId": "same-session-id-from-step-1",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:rag",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
})
```

{% endtab %}

{% tab title="Javascript" %}

```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "What is the speech about?",
    "chatId": "same-session-id-from-step-1",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:rag",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
}).then((response) => {
    console.log(response);
});
```

{% endtab %}
{% endtabs %}

### Full File Uploads

With RAG file uploads, you can't work with structured data like spreadsheets or tables, and you can't perform full summarization due to lack of full context. In some cases, you might want to include all the file content directly in the prompt for an LLM, especially with models like Gemini and Claude that have longer context windows. [This research paper](https://arxiv.org/html/2407.16833v1) is one of many that compare RAG with longer context windows.

To enable full file uploads, go to **Chatflow Configuration**, open the **File Upload** tab, and click the switch:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-9020bb70fa0e381aefbb189b564bd81490413782%2Fimage%20(1)%20(1)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

You can see the **File Attachment** button in the chat, where you can upload one or more files. Under the hood, the [File Loader](https://docs.flowiseai.com/integrations/langchain/document-loaders/file-loader) processes each file and converts it into text.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-9dd4614e23d8f3ddfd6721a23eaaf060434db0fb%2Fimage%20(1)%20(1)%20(1)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Note that if your chatflow uses a Chat Prompt Template node, an input must be created from **Format Prompt Values** to pass the file data. The specified input name (e.g. {file}) should be included in the **Human Message** field.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-267aaead77f05eb8710f1dfa38a15c00356903bd%2Fchat-prompt-template-file-attachment.jpg?alt=media" alt=""><figcaption></figcaption></figure>

To upload files with the API:

{% tabs %}
{% tab title="Python" %}

```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "question": "What is the data about?",
    "chatId": "some-session-id",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:full",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
})
```

{% endtab %}

{% tab title="Javascript" %}

```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "What is the data about?",
    "chatId": "some-session-id",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:full",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
}).then((response) => {
    console.log(response);
});
```

{% endtab %}
{% endtabs %}

As you can see in the examples, uploads require a base64 string. To get a base64 string for a file, use the [Create Attachments API](https://docs.flowiseai.com/api-reference/attachments).

### Difference between Full & RAG Uploads

Both Full and RAG (Retrieval-Augmented Generation) file uploads serve different purposes.

* **Full File Upload**: This method parses the entire file into a string and sends it to the LLM (Large Language Model). It's beneficial for summarizing the document or extracting key information. However, with very large files, the model might produce inaccurate results or "hallucinations" due to token limitations.
* **RAG File Upload**: Recommended if you aim to reduce token costs by not sending the entire text to the LLM. This approach is suitable for Q\&A tasks on the documents but isn't ideal for summarization since it lacks the full document context. This approach might takes longer time because of the upsert process.
