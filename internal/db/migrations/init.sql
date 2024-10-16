-- Create a table for storing user information
CREATE TABLE users (
    id UUID PRIMARY KEY,
    role VARCHAR(50) DEFAULT 'user',
    username VARCHAR(50) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a table for storing account information
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    account_type VARCHAR(50) NOT NULL,
    balance DECIMAL(15, 2) NOT NULL CHECK (balance >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create a table for storing transaction information
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER REFERENCES accounts(id) NOT NULL,
    receiver_account_id INTEGER REFERENCES accounts(id) NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    transaction_reference VARCHAR(50) NOT NULL,
    transaction_status VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);