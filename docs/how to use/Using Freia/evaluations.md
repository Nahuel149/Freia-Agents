# Evaluations

{% hint style="info" %}
Evaluations are only available for Cloud and Enterprise plan
{% endhint %}

Evaluations help you monitor and understand the performance of your Chatflow/Agentflow application. On the high level, an evaluation is a process that takes a set of inputs and corresponding outputs from your Chatflow/Agentflow, and generates scores. These scores can be derived by comparing outputs to reference results, such as through string matching, numeric comparison, or even leveraging an LLM as a judge. These evaluations are conducted using Datasets and Evaluators.

## Datasets

Datasets are the inputs that will be used to run your Chatflow/Agentflow, along with the corresponding outputs for comparison. User can add the input and anticipated output manually, or upload a CSV file with 2 columns: Input and Output.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-23d23a733788451a5562b5ae6be397e4747aa0cb%2Fimage%20(3).png?alt=media" alt=""><figcaption></figcaption></figure>

| Input                             | Output                       |
| --------------------------------- | ---------------------------- |
| What is the capital of UK         | Capital of UK is London      |
| How many days are there in a year | There are 365 days in a year |

## Evaluators

Evaluators are like unit tests. During an evaluation, the inputs from Datasets are ran on the selected flows and the outputs are evaluated using selected evaluators. There are 3 types of evaluators:

* **Text Based**: string based checking:
  * Contains Any
  * Contains All
  * Does Not Contains Any
  * Does Not Contains All
  * Starts With
  * Does Not Starts With

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-d7617d21af5f0e31337750ce90abb81be066fddd%2Fimage%20(6).png?alt=media" alt=""><figcaption></figcaption></figure>

* **Numeric Based:** numbers type checking:
  * Total Tokens
  * Prompt Tokens
  * Completion Tokens
  * API Latency
  * LLM Latency
  * Chatflow Latency
  * Agentflow Latency (coming)
  * Output Characters Length

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-b2590f8912fa6bb2739b40bb3d60209adf512a60%2Fimage%20(7).png?alt=media" alt=""><figcaption></figcaption></figure>

* **LLM Based**: using another LLM to grade the output
  * Hallucination
  * Correctness

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-d660c992b9e1e94d549f2347d7b68e8b81af5f37%2Fimage%20(9).png?alt=media" alt=""><figcaption></figcaption></figure>

## Evaluations

Now that we have Datasets and Evaluators prepared, we can start running an evaluation.

1.) Select dataset and chatflow to evaluate. You can select multiple datasets and chatflows. Using the example below, every inputs from Dataset1 will be ran against 2 chatflows. Since Dataset1 has 2 inputs, a total of 4 outputs will be produced and evaluated.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-32f0646b293a9ec1e672c6d2e83fa054d3ef0da7%2Fimage%20(10).png?alt=media" alt=""><figcaption></figcaption></figure>

2.) Select the evaluators. Only string based and numeric based evaluators are available to be selected at this stage.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-addf116606a7d2cbe5fca0d6148d868dad61460e%2Fimage%20(11).png?alt=media" alt=""><figcaption></figcaption></figure>

3.) (Optional) Select LLM Based evaluator. Start Evaluation:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-149b588988b4b961a89eec55e761cbe235619759%2Fimage%20(12).png?alt=media" alt=""><figcaption></figcaption></figure>

4.) Wait for evaluation to be completed:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-070e8fff2f45d8b8879a9002fe60b4548356ab80%2Fimage%20(13).png?alt=media" alt=""><figcaption></figcaption></figure>

5.) After evaluation is completed, click the graph icon at the right side to view the details:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-92c99bd78da4fd6fba0f11bfc27905b00fe6450a%2Fimage%20(14).png?alt=media" alt=""><figcaption></figcaption></figure>

The 3 charts above show the summary of the evaluation:

* Pass/fail rate
* Average prompt and completion tokens used
* Average latency of the request

Table below the charts shows the details of each execution.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-5f2011f3e13381396f5eabc97d2e409fc8faa1a7%2Fimage%20(15).png?alt=media" alt=""><figcaption></figcaption></figure>

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-e48c7512461d6fe255ce5c5956ef5bdd1ee3264a%2Fimage%20(16).png?alt=media" alt="" width="355"><figcaption></figcaption></figure>

### Re-run evaluation

When the flows used on evaluation have been updated/modified, a warning message will be shown:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-e2d1bcc3bc14bf0172406b5561bff95436618f6a%2Fimage%20(17).png?alt=media" alt=""><figcaption></figcaption></figure>

You can re-run the same evaluation using the Re-Run Evaluation button at the top right corner. You will be able to see the different versions:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-0977fe862ac5405aa1798026b81b0a170b6c7766%2Fimage%20(18).png?alt=media" alt=""><figcaption></figcaption></figure>

You can also view and compare the results from different versions:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-8bf627c53e27c06b9e8c33b103d72f80632646fc%2Fimage%20(19).png?alt=media" alt=""><figcaption></figcaption></figure>

## Video Tutorial

{% embed url="<https://youtu.be/kgUttHMkGFg?si=3rLplEp_0TI0p6UV&t=486>" %}
