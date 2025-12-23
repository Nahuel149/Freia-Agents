// assets
import {
    IconList,
    IconUsersGroup,
    IconHierarchy,
    IconBuildingStore,
    IconKey,
    IconTool,
    IconLock,
    IconRobot,
    IconSettings,
    IconVariable,
    IconFiles,
    IconTestPipe,
    IconMicroscope,
    IconDatabase,
    IconChartHistogram,
    IconUserEdit,
    IconFileUpload,
    IconClipboardList,
    IconStack2,
    IconUsers,
    IconLockCheck,
    IconFileDatabase,
    IconShieldLock,
    IconListCheck,
    IconDashboard,
    IconCode,
    IconFileText,
    IconLogout
} from '@tabler/icons-react'

// constant
const icons = {
    IconHierarchy,
    IconUsersGroup,
    IconBuildingStore,
    IconList,
    IconKey,
    IconTool,
    IconLock,
    IconRobot,
    IconSettings,
    IconVariable,
    IconFiles,
    IconTestPipe,
    IconMicroscope,
    IconDatabase,
    IconUserEdit,
    IconChartHistogram,
    IconFileUpload,
    IconClipboardList,
    IconStack2,
    IconUsers,
    IconLockCheck,
    IconFileDatabase,
    IconShieldLock,
    IconListCheck,
    IconDashboard,
    IconCode,
    IconFileText,
    IconLogout
}

// ==============================|| DASHBOARD MENU ITEMS ||============================== //

const dashboard = {
    id: 'dashboard',
    title: '',
    type: 'group',
    children: [
        {
            id: 'primary',
            title: '',
            type: 'group',
            children: [
                {
                    id: 'agentflows',
                    title: 'Agentflows',
                    type: 'item',
                    url: '/agentflows',
                    icon: icons.IconUsersGroup,
                    breadcrumbs: true,
                    permission: 'chatflows:view'
                },
                {
                    id: 'chatflows',
                    title: 'Chatflows',
                    type: 'item',
                    url: '/chatflows',
                    icon: icons.IconHierarchy,
                    breadcrumbs: true,
                    permission: 'chatflows:view'
                },
                {
                    id: 'document-stores',
                    title: 'Document Stores',
                    type: 'item',
                    url: '/document-stores',
                    icon: icons.IconFiles,
                    breadcrumbs: true,
                    permission: 'documentStores:view'
                },
                {
                    id: 'code-tools',
                    title: 'More',
                    type: 'collapse',
                    icon: icons.IconCode,
                    children: [
                        {
                            id: 'executions-more',
                            title: 'Executions',
                            type: 'item',
                            url: '/executions',
                            icon: icons.IconListCheck,
                            breadcrumbs: true,
                            permission: 'executions:view'
                        },
                        {
                            id: 'dashboard',
                            title: 'Dashboard',
                            type: 'item',
                            url: '/dashboard',
                            icon: icons.IconDashboard,
                            breadcrumbs: true,
                            permission: 'dashboard:view'
                        },
                        {
                            id: 'templates',
                            title: 'Templates',
                            type: 'item',
                            url: '/templates',
                            icon: icons.IconBuildingStore,
                            breadcrumbs: true,
                            permission: 'templates:marketplace,templates:custom'
                        }
                    ]
                }
            ]
        },
        {
            id: 'tools-group',
            title: 'Tools & Configuration',
            type: 'group',
            children: [
                {
                    id: 'tools',
                    title: 'Tools',
                    type: 'item',
                    url: '/tools',
                    icon: icons.IconTool,
                    breadcrumbs: true,
                    permission: 'tools:view'
                },
                {
                    id: 'credentials',
                    title: 'Credentials',
                    type: 'item',
                    url: '/credentials',
                    icon: icons.IconLock,
                    breadcrumbs: true,
                    permission: 'credentials:view'
                },
                {
                    id: 'apikey',
                    title: 'API Keys',
                    type: 'item',
                    url: '/apikey',
                    icon: icons.IconKey,
                    breadcrumbs: true,
                    permission: 'apikeys:view'
                }
            ]
        },
        {
            id: 'evaluations-group',
            title: 'Evaluations',
            type: 'collapse',
            icon: icons.IconChartHistogram,
            children: [
                {
                    id: 'datasets',
                    title: 'Datasets',
                    type: 'item',
                    url: '/datasets',
                    icon: icons.IconDatabase,
                    breadcrumbs: true,
                    display: 'feat:datasets',
                    permission: 'datasets:view'
                },
                {
                    id: 'evaluators',
                    title: 'Evaluators',
                    type: 'item',
                    url: '/evaluators',
                    icon: icons.IconTestPipe,
                    breadcrumbs: true,
                    display: 'feat:evaluators',
                    permission: 'evaluators:view'
                },
                {
                    id: 'evaluations-list',
                    title: 'Evaluations',
                    type: 'item',
                    url: '/evaluations',
                    icon: icons.IconChartHistogram,
                    breadcrumbs: true,
                    display: 'feat:evaluations',
                    permission: 'evaluations:view'
                },
                {
                    id: 'marketplaces',
                    title: 'Marketplaces',
                    type: 'item',
                    url: '/marketplaces',
                    icon: icons.IconBuildingStore,
                    breadcrumbs: true,
                    permission: 'templates:marketplace,templates:custom'
                },
                {
                    id: 'variables',
                    title: 'Variables',
                    type: 'item',
                    url: '/variables',
                    icon: icons.IconVariable,
                    breadcrumbs: true,
                    permission: 'variables:view'
                },
                {
                    id: 'assistants',
                    title: 'Assistants',
                    type: 'item',
                    url: '/assistants',
                    icon: icons.IconRobot,
                    breadcrumbs: true,
                    permission: 'assistants:view'
                }
            ]
        },
        {
            id: 'others',
            title: 'Others',
            type: 'group',
            children: [
                {
                    id: 'account',
                    title: 'Account Settings',
                    type: 'item',
                    url: '/account',
                    icon: icons.IconSettings,
                    breadcrumbs: true,
                    display: 'feat:account'
                },
                {
                    id: 'support',
                    title: 'Support',
                    type: 'item',
                    url: '/support',
                    icon: icons.IconFileText,
                    breadcrumbs: true
                },
                {
                    id: 'payments-others',
                    title: 'Payments',
                    type: 'item',
                    url: '/payments',
                    icon: icons.IconBuildingStore,
                    breadcrumbs: true,
                    permission: 'chatflows:view'
                },
                {
                    id: 'logout',
                    title: 'Logout',
                    type: 'item',
                    url: '/logout',
                    icon: icons.IconLogout,
                    breadcrumbs: true
                }
            ]
        }
    ]
}

export default dashboard
