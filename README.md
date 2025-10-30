# CNT_Course_Project

# 🔒 P2P Encrypted Chat

This project is a simple, browser-based, peer-to-peer (P2P) chat application. It uses WebRTC for direct communication between users, with all messages secured by end-to-end encryption (DTLS). A Node.js signaling server is used to help users discover and connect to each other.

## ✨ Features

* **Peer-to-Peer Communication**: Messages are sent directly between users' browsers without passing through a central server after the connection is established.
* **End-to-End Encryption**: Chat is secured using WebRTC's built-in DTLS, ensuring that only the participants can read the messages.
* **Signaling Server**: Uses Socket.io for user discovery and to "signal" (exchange connection details) between peers.
* **Real-time User List**: See who is currently online and available to chat.
* **Active Connections List**: Manage your active P2P connections.
* **Optional Libp2p Relay**: Includes a `relay.js` server that can be run to help peers connect even if they are behind restrictive firewalls (NAT traversal).

---

## 🚀 How It Works

1.  **Signaling**: When a user opens the chat, they connect to the **Signaling Server** (`server.js`) via Socket.io. This server keeps track of all online users.
2.  **Discovery**: The server shares the list of online users with everyone.
3.  **Connection**: When User A clicks "Connect" on User B, they use the signaling server to exchange WebRTC connection details (called "signals").
4.  **P2P Link**: Using these signals, User A and User B establish a direct, encrypted P2P connection using the `simple-peer` (WebRTC) library.
5.  **Chat**: All subsequent messages are sent directly over this secure P2P channel. The signaling server is no longer involved in their chat.

---

## 💻 Tech Stack

* **Frontend**: HTML, CSS, JavaScript
* **Signaling**: Node.js, Express, Socket.io
* **P2P & Encryption**: WebRTC (via `simple-peer`)
* **Optional Relay**: libp2p (`@libp2p/circuit-relay-v2`)

---

## 🛠️ Installation

1.  Clone the repository:
    ```sh
    git clone [https://github.com/your-username/CNT_Course_Project.git](https://github.com/your-username/CNT_Course_Project.git)
    cd CNT_Course_Project
    ```

2.  Install the server and client dependencies:
    ```sh
    npm install
    ```

---

## 🏃‍♂️ Usage

You must run the signaling server for the application to work.

### 1. Start the Signaling Server

This is the main server required for users to find each other.

```sh
npm start
