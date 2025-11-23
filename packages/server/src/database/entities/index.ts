import { ChatFlow } from './ChatFlow'
import { ChatMessage } from './ChatMessage'
import { ChatMessageFeedback } from './ChatMessageFeedback'
import { Credential } from './Credential'
import { Tool } from './Tool'
import { Assistant } from './Assistant'
import { Variable } from './Variable'
import { DocumentStore } from './DocumentStore'
import { DocumentStoreFileChunk } from './DocumentStoreFileChunk'
import { Lead } from './Lead'
import { UpsertHistory } from './UpsertHistory'
import { Dataset } from './Dataset'
import { DatasetRow } from './DatasetRow'
import { EvaluationRun } from './EvaluationRun'
import { Evaluation } from './Evaluation'
import { Evaluator } from './Evaluator'
import { ApiKey } from './ApiKey'
import { CustomTemplate } from './CustomTemplate'
import { LandingTemplate } from './LandingTemplate'
import { UserTemplate } from './UserTemplate'
import { Execution } from './Execution'
import { CodeAgent } from './CodeAgent'
import { CodeAgentExecution } from './CodeAgentExecution'
import { SupportTicket } from './SupportTicket'
import { AgentEvent } from './AgentEvent'
import { SaleRecord } from './SaleRecord'
import { ProductInventory } from './ProductInventory'
import { ClientAccount } from './ClientAccount'
import { FollowUp } from './FollowUp'
import { ToolAlert } from './ToolAlert'
import { PriceApprovalRequest } from './PriceApprovalRequest'
// OSS mode: import all entities from OSS directory
import { LoginActivity, WorkspaceShared, WorkspaceUsers } from '../../oss/database/entities/EnterpriseEntities'
import { User } from '../../oss/database/entities/user.entity'
import { Account } from '../../oss/database/entities/account.entity'
import { Role } from '../../oss/database/entities/role.entity'
import { OrganizationUser } from '../../oss/database/entities/organization-user.entity'
import { Workspace } from '../../oss/database/entities/workspace.entity'
import { WorkspaceUser } from '../../oss/database/entities/workspace-user.entity'
import { LoginMethod } from '../../oss/database/entities/login-method.entity'
import { Contact } from '../../oss/database/entities/contact.entity'
import { Deal } from '../../oss/database/entities/deal.entity'
import { Interaction } from '../../oss/database/entities/interaction.entity'
import { Task } from '../../oss/database/entities/task.entity'

const additionalEntities = {
    User,
    WorkspaceUsers,
    LoginActivity,
    WorkspaceShared,
    Account,
    Role,
    OrganizationUser,
    Workspace,
    WorkspaceUser,
    LoginMethod,
    Contact,
    Deal,
    Interaction,
    Task
}

export const entities = {
    ChatFlow,
    ChatMessage,
    ChatMessageFeedback,
    Credential,
    Tool,
    Assistant,
    Variable,
    UpsertHistory,
    DocumentStore,
    DocumentStoreFileChunk,
    Lead,
    Dataset,
    DatasetRow,
    Evaluation,
    EvaluationRun,
    Evaluator,
    ApiKey,
    CustomTemplate,
    LandingTemplate,
    UserTemplate,
    Execution,
    CodeAgent,
    CodeAgentExecution,
    SupportTicket,
    AgentEvent,
    SaleRecord,
    ProductInventory,
    ClientAccount,
    FollowUp,
    ToolAlert,
    PriceApprovalRequest,
    ...additionalEntities
}
