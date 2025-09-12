-- Database schema for CodeAgent Orchestration System
-- Extends the existing CodeAgent functionality with B2B-style orchestration
-- Schema will be created in the existing freia_postgres database

-- Table for code development sessions (similar to customers in B2B)
CREATE TABLE code_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    user_id VARCHAR(100), -- Optional user identifier
    project_name VARCHAR(200),
    project_description TEXT,
    programming_language VARCHAR(50),
    framework VARCHAR(100),
    complexity_level VARCHAR(20) DEFAULT 'medium', -- simple, medium, complex, enterprise
    session_context TEXT, -- JSON string with session state
    current_phase VARCHAR(50) DEFAULT 'planning', -- planning, development, testing, debugging, optimization
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for code generation tasks (similar to sales in B2B)
CREATE TABLE code_tasks (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES code_sessions(id),
    code_agent_id VARCHAR(100), -- Reference to existing CodeAgent
    task_type VARCHAR(50) NOT NULL, -- generation, debugging, optimization, testing, documentation
    task_description TEXT NOT NULL,
    input_requirements TEXT, -- JSON string with input specifications
    generated_code TEXT,
    programming_language VARCHAR(50),
    framework VARCHAR(100),
    complexity_score INTEGER DEFAULT 1, -- 1-10 scale
    execution_status VARCHAR(20) DEFAULT 'pending', -- pending, running, completed, failed, needs_review
    execution_time_ms INTEGER,
    error_message TEXT,
    quality_score DECIMAL(3,2), -- 0.00-10.00 quality assessment
    agent_confidence DECIMAL(3,2), -- 0.00-1.00 confidence level
    user_feedback TEXT,
    user_rating INTEGER, -- 1-5 stars
    iteration_count INTEGER DEFAULT 1,
    agent_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for code improvement follow-ups (similar to follow_ups in B2B)
CREATE TABLE code_followups (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES code_sessions(id),
    task_id INTEGER REFERENCES code_tasks(id),
    followup_type VARCHAR(50) NOT NULL, -- code_review, optimization_suggestion, bug_fix, feature_enhancement, documentation_update
    scheduled_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, cancelled, in_progress
    priority_level VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
    attempt_number INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    suggestion_message TEXT,
    implementation_code TEXT,
    user_response TEXT,
    next_action VARCHAR(100),
    agent_assigned VARCHAR(50), -- Which specialized agent should handle this
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for code analysis and metrics
CREATE TABLE code_analysis (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES code_tasks(id),
    analysis_type VARCHAR(50) NOT NULL, -- complexity, performance, security, maintainability, best_practices
    analysis_result TEXT, -- JSON string with detailed analysis
    score DECIMAL(3,2), -- 0.00-10.00 score for this analysis type
    issues_found INTEGER DEFAULT 0,
    suggestions_count INTEGER DEFAULT 0,
    critical_issues INTEGER DEFAULT 0,
    warnings INTEGER DEFAULT 0,
    analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for agent interactions and conversations
CREATE TABLE agent_interactions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES code_sessions(id),
    task_id INTEGER REFERENCES code_tasks(id),
    agent_type VARCHAR(50) NOT NULL, -- main_code_agent, debugging_agent, optimization_agent, testing_agent
    interaction_type VARCHAR(50) NOT NULL, -- user_query, agent_response, code_generation, error_handling
    message_content TEXT NOT NULL,
    code_snippet TEXT,
    metadata TEXT, -- JSON string with additional context
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for code templates and patterns (for learning and suggestions)
CREATE TABLE code_patterns (
    id SERIAL PRIMARY KEY,
    pattern_name VARCHAR(200) NOT NULL,
    programming_language VARCHAR(50) NOT NULL,
    framework VARCHAR(100),
    pattern_type VARCHAR(50), -- design_pattern, best_practice, common_solution, boilerplate
    description TEXT,
    code_template TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0.00,
    tags TEXT, -- JSON array of tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_code_sessions_session_id ON code_sessions(session_id);
CREATE INDEX idx_code_sessions_user_id ON code_sessions(user_id);
CREATE INDEX idx_code_sessions_last_activity ON code_sessions(last_activity);
CREATE INDEX idx_code_sessions_phase ON code_sessions(current_phase);

CREATE INDEX idx_code_tasks_session_id ON code_tasks(session_id);
CREATE INDEX idx_code_tasks_agent_id ON code_tasks(code_agent_id);
CREATE INDEX idx_code_tasks_status ON code_tasks(execution_status);
CREATE INDEX idx_code_tasks_type ON code_tasks(task_type);
CREATE INDEX idx_code_tasks_language ON code_tasks(programming_language);

CREATE INDEX idx_code_followups_session_id ON code_followups(session_id);
CREATE INDEX idx_code_followups_scheduled ON code_followups(scheduled_at);
CREATE INDEX idx_code_followups_status ON code_followups(status);
CREATE INDEX idx_code_followups_priority ON code_followups(priority_level);

CREATE INDEX idx_code_analysis_task_id ON code_analysis(task_id);
CREATE INDEX idx_code_analysis_type ON code_analysis(analysis_type);

CREATE INDEX idx_agent_interactions_session_id ON agent_interactions(session_id);
CREATE INDEX idx_agent_interactions_agent_type ON agent_interactions(agent_type);
CREATE INDEX idx_agent_interactions_created_at ON agent_interactions(created_at);

CREATE INDEX idx_code_patterns_language ON code_patterns(programming_language);
CREATE INDEX idx_code_patterns_framework ON code_patterns(framework);
CREATE INDEX idx_code_patterns_type ON code_patterns(pattern_type);

-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_code_sessions_updated_at BEFORE UPDATE ON code_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_tasks_updated_at BEFORE UPDATE ON code_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_followups_updated_at BEFORE UPDATE ON code_followups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_code_patterns_updated_at BEFORE UPDATE ON code_patterns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO code_sessions (session_id, project_name, project_description, programming_language, framework, complexity_level) VALUES
('session_001', 'E-commerce API', 'REST API for online store with user authentication and payment processing', 'javascript', 'express', 'complex'),
('session_002', 'Data Visualization Dashboard', 'Interactive dashboard for business analytics', 'python', 'flask', 'medium');

INSERT INTO code_patterns (pattern_name, programming_language, framework, pattern_type, description, code_template) VALUES
('Express Route Handler', 'javascript', 'express', 'boilerplate', 'Standard Express.js route handler with error handling', 'app.get("/api/endpoint", async (req, res) => {\n  try {\n    // Your logic here\n    res.json({ success: true });\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});'),
('Python Class Template', 'python', null, 'boilerplate', 'Basic Python class with constructor and methods', 'class ClassName:\n    def __init__(self, param):\n        self.param = param\n    \n    def method_name(self):\n        pass');