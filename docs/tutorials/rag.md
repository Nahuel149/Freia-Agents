# RAG

Large Language Models (LLMs) have unlocked the potential to create advanced Q\&A chatbots capable of delivering precise answers based on specific content. These systems rely on a method called Retrieval-Augmented Generation (RAG), which enhances their responses by grounding them in relevant source material.

In this tutorial, you’ll learn how to create a basic Q\&A application that can extract and answer questions from given document sources.

The process can be separated out into 2 sub-processes:

* Indexing
* Retrieval

## Indexing

[Document Stores](https://docs.flowiseai.com/using-flowise/document-stores) is designed to help with the whole indexing pipelines - retrieveing data from different sources, chunking strategy, upserting to vector database, syncing with updated data.

We support wide range of document loaders, ranging from files like Pdf, Word, Google Drive, to web scrapers like Playwright, Firecrawl, Apify and others. You can also create custom document loader.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FFTaL7YHgDIWVGUocppaA%2Fimage.png?alt=media&#x26;token=2d5a443b-4fa0-4c86-b5f3-c1dfd2c7271a" alt="" width="563"><figcaption></figcaption></figure>

## Retrieval

Based on the user's input, relevant document chunks are fetched from vector database. LLM then uses the retrieved context to generate a response.

1. Drag and drop an [Agent](https://docs.flowiseai.com/using-flowise/agentflowv2#id-3.-agent-node) node, and configure the model to use.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FgHTQf8AUJCzkkgnqIGd6%2Fimage.png?alt=media&#x26;token=1591cc59-0dae-43a1-92a1-f66adbfc8d12" alt="" width="391"><figcaption></figcaption></figure>

2. Add a new Knowledge (Document Store) and define what the content is about. This helps the LLM understand when and how to retrieve relevant information. You can also use the auto-generate button to assist with this process.

{% hint style="success" %}
Only upserted document store can be used
{% endhint %}

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FIeiE8xaLGQztjA0eQa1u%2Fimage.png?alt=media&#x26;token=16c74e67-9f6e-4c00-b703-ba65e21f9566" alt="" width="482"><figcaption></figcaption></figure>

3. (Optional) If the data has already been stored in a vector database without going through the document store indexing pipeline, you can also connect directly to the vector database and embedding model.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fj1gPEYQ47seEnRb7TPcJ%2Fimage.png?alt=media&#x26;token=a848a889-d4d4-4ff1-b85e-da0924a4ed9f" alt="" width="388"><figcaption></figcaption></figure>

4. Add a system prompt, or use the **Generate** button to assist. We recommend using it, as it helps craft a more effective and optimized prompt.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FvPoL62kuLi8MZjx2NsNV%2Fimage.png?alt=media&#x26;token=233ae422-e271-480d-bbce-e700afae7027" alt="" width="482"><figcaption></figcaption></figure>

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2FEhRrbel0ddrFAzrkNArx%2Fimage.png?alt=media&#x26;token=c40ee4d5-bc99-4c01-9c15-c086a08a9db0" alt="" width="563"><figcaption></figcaption></figure>

5. Your RAG agent is now ready to use!

## Resources

{% embed url="<https://youtu.be/KHc0ClOIv0A?si=mEZJydM8bT2imKJY>" %}
