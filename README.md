# Web Chat Server

## Overview
This project is a web chat server built as a learning exercise to understand and implement real-time communication using Socket.IO. 

## Features
- **Real-time Communication:** Utilizes Socket.IO for bidirectional, event-based communication between the server and clients.
- **Multiple Rooms:** Supports the creation of multiple chat rooms for users to join and interact in.
- **Message Persistence:** Optionally stores chat messages in a SQL database for future retrieval or history viewing.

## Technologies Used
- **Node.js:** Server-side JavaScript runtime environment.
- **Socket.IO:** JavaScript library for real-time web applications, enabling bidirectional communication between web clients and servers.
- **SQL (Structured Query Language):** Database language used for storing and retrieving chat messages.

## How to Run
1. Clone the repository to your local machine.
2. Install dependencies using `npm install`.
3. Start the server with `node --watch ./server/index.js`.
4. Access the chat application via a web brow