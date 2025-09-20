# Workspaces

{% hint style="info" %}
Evaluations are only available for Cloud and Enterprise plan
{% endhint %}

Upon your initial login, a default workspace will be automatically generated for you. Workspaces serve to partition resources among various teams or business units. Inside each workspace, Role-Based Access Control (RBAC) is used to manage permissions and access, ensuring users have access only to the resources and settings required for their role.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-de2aaac22e8690415280667e823c1b5c35887799%2FUntitled-2024-10-19-0050.png?alt=media" alt=""><figcaption></figcaption></figure>

## Setting up Admin Account

<details>

<summary>For self-hosted enterprise, following env variables must be set</summary>

```
JWT_AUTH_TOKEN_SECRET
JWT_REFRESH_TOKEN_SECRET
JWT_ISSUER
JWT_AUDIENCE
JWT_TOKEN_EXPIRY_IN_MINUTES
JWT_REFRESH_TOKEN_EXPIRY_IN_MINUTES
PASSWORD_RESET_TOKEN_EXPIRY_IN_MINS
PASSWORD_SALT_HASH_ROUNDS
TOKEN_HASH_SECRET
```

</details>

By default, new installation of Flowise will require an admin setup, similar to how you have to setup a root user for your database initially.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-0a3b740279e2ee574f23d60eb942b497f4cacf97%2Fimage%20(2)%20(1)%20(1).png?alt=media" alt="" width="478"><figcaption></figcaption></figure>

After setting up, user will be brought to Flowise dashboard. From the left side bar, you will see User & Workspace Management section. A default workspace was automatically created.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-7ef759372dfd3277d4feda2416c3f4c485c17de2%2Fimage%20(1)%20(1)%20(1)%20(1)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

## Creating Workspace

To create a new Workspace, click Add New:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-1c7ee1dd3db1f43668f61375a864512d41f39614%2Fimage%20(3)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

You will see yourself added as the Organization Admin in the workspace you created.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-f128d34e1af4c387a84a9ad9bbeda6e68ac997b2%2Fimage%20(4)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

To invite new users to the workspace, you need to create a Role first.

## Creating Role

Navigate to Roles in the left side bar, and click Add Role:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-35e23324ed0f7cd29fc120b2850de669b91ca0a3%2Fimage%20(5)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

User can specify granular control of permissions for each resources. The only exceptions are the resources in **User & Workspace Management** (Roles, Users, Workspaces, Login Activity). These are only available for Account Admin for now.

Here, we create an editor role which has access to everything. And another role with view-only permissions.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-ef6d8157332c9fbf823431d4495a92e01dbaa5bb%2Fimage%20(6)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

## Invite User

<details>

<summary>For self-hosted enterprise, the following env variables must be set</summary>

```
INVITE_TOKEN_EXPIRY_IN_HOURS
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
```

</details>

Navigate to Users in left side bar, you will see yourself as the account admin. This is indicated by the person icon with a star:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-f3d7516a2da971a529c186ca778915f72e28ce26%2Fimage%20(7)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Click Invite User, and enter email to be invited, the workspace to be assigned, and the role as well.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-635f5bff196196687c693033547c5885ea695a97%2Fimage%20(8)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Click Send Invite. The invited email will receive an invitation:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-e403f932dd38d33d943812e601891f6168b9935b%2Fimage%20(9)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Upon clicking the invitation link, invited user will be brought to a Sign Up page.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-0e574164866d37e2e152d9a2c54e577654273c36%2Fimage%20(10)%20(1).png?alt=media" alt="" width="463"><figcaption></figcaption></figure>

After signed up and logged in as invited user, you will be in the workspace assigned, and there will be no User & Workspace Management section:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-5d08d05904a9feaf0d9af8e60959f837beb489fc%2Fimage%20(11)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

If you are invited into multiple workspaces, you can switch to different workspaces from the top right dropdown button. Here we are assigned to Workspace 2 with **view only** permission. You can notice the Add New button for Chatflow is no longer visible. This ensure user can only view, not create, update nor delete. The same RBAC rules apply for API as well.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-5aa164fc3891d8bd3720d62c7e8c44c8defe3e7c%2Fimage%20(12)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Now, back to Account Admin, you will be able to see the users invited, their status, roles, and active workspace:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-339c68b7d313040e66d474986955739054ee1cdf%2Fimage%20(14)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Account admin can also modify the settings for other users:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-434ea80d787555187928c1be3339291a8277a0ae%2Fimage%20(15)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

## Login Activity

Admin will be able to see every login and logout from all users:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-32204e65a8290519bc7a558abd666b991d5c3a7c%2Fimage%20(13)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

## Creating item in Workspace

Every items created in a workspace, are isolated from another workspace. Workspaces are a way to logically group users and resources within an organization, ensuring separate trust boundaries for resource management and access control. It is recommended to create distinct workspaces for each team.

Here, we create a Chatflow named **Chatflow1** in **Workspace1**:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-8911e8d88228326502b8b05a32f0b0db9dac8a37%2Fimage%20(16)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

When we switch to **Workspace2**, **Chatflow1** will not be visible. This applies to every resources such as Agentflows, Tools, Assistants, etc.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-724e8e274011d51c86a5879e213a9c9e5d011e2a%2Fimage%20(17)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

The diagram below illustrates the relationship between organizations, workspaces, and the various resources associated with and contained within a workspace.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-de2aaac22e8690415280667e823c1b5c35887799%2FUntitled-2024-10-19-0050.png?alt=media" alt=""><figcaption></figcaption></figure>

## Sharing Credential

You can share credential to other workspaces. This allow users to reuse same set of credentials in different workspaces.

After creating a credential, Account Admin or user with Share Credential permission from the RBAC will be able to click Share:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-8229bc3ec6b7ba22814ae133be4a6b3208e567c9%2Fimage%20(18)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

User can select the workspaces to share the credential with:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-55a6b65094eae675c02ffc7ab140fdd0d5c257a9%2Fimage%20(19)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

Now, switch to the workspace where the credential was shared, you will see the Shared Credential. User is not able to edit shared credential.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-3d3bcc9bd0a3c1bfe3061de0d028542987387b0d%2Fimage%20(20)%20(1).png?alt=media" alt=""><figcaption></figcaption></figure>

## Deleting a Workspace

Currently only Account Admin can delete workspaces. By default, you are not able to delete a workspace if there are still users within that workspace.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-44d1dc48def92b34437b3ee66421c6589a0029d3%2Fimage%20(21).png?alt=media" alt=""><figcaption></figcaption></figure>

You will need to unlink all of the invited users first. This allow flexibility in case you just want to remove certain users from a workspace. Note that Organization Owner who created the workspace is not able to be unlinked from a workspace.

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-bde4e6cfc137984e7872f67cef7f67507fe988d2%2Fimage%20(22).png?alt=media" alt=""><figcaption></figcaption></figure>

After unlinking invited users, and the only user left within the workspace is the Organization Owner, delete button is now clickable:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-851200ea85b84d2b7af0150a5642b15f3c96ac61%2Fimage%20(23).png?alt=media" alt=""><figcaption></figcaption></figure>

Deleting a workspace is an irreversible action and will cascade delete all items within that workspace. You will see a warning box:

<figure><img src="https://823733684-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F00tYLwhz5RyR7fJEhrWy%2Fuploads%2Fgit-blob-82413b595fbd421156e97bb4db72a5fae11c996c%2Fimage%20(24).png?alt=media" alt=""><figcaption></figcaption></figure>

After deleting a workspace, user will fallback to the Default workspace. Default workspace that was automatically created at the start is not able to be deleted.
