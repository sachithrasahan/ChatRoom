using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace ChatAppApi
{
    public class ChatHub : Hub
    {
        private static readonly ConcurrentDictionary<string, string> Connections = new();
        private static readonly List<(string User, string Message, DateTime Timestamp)> Messages = new();
        private static readonly ConcurrentDictionary<string, bool> TypingUsers = new();

        // Called when a connection starts
        public override async Task OnConnectedAsync()
        {
            var username = Context.GetHttpContext()?.Request.Query["username"].ToString();

            if (!string.IsNullOrEmpty(username))
            {
                Connections[Context.ConnectionId] = username;

                // Notify others only if this is the first connection for that user
                if (!Connections.Values.Where(u => u == username).Skip(1).Any())
                    await Clients.Others.SendAsync("UserJoined", username);

                // Send chat history to the new user
                await Clients.Caller.SendAsync("LoadMessages", Messages);

                await SendUserList();
            }

            await base.OnConnectedAsync();
        }

        // Called when a connection ends
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            if (Connections.TryRemove(Context.ConnectionId, out var username))
            {
                // Only notify if user has no other active connections
                if (!Connections.Values.Contains(username))
                {
                    await Clients.Others.SendAsync("UserLeft", username);
                    TypingUsers.TryRemove(username, out _);
                    await SendUserList();
                }
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinChat(string username)
        {
            if (!string.IsNullOrEmpty(username))
            {
                Connections[Context.ConnectionId] = username;

                // Notify others that a user joined
                if (!Connections.Values.Where(u => u == username).Skip(1).Any())
                    await Clients.Others.SendAsync("UserJoined", username);

                // Send chat history to the new user
                await Clients.Caller.SendAsync("LoadMessages", Messages);

                await SendUserList();
            }
        }


        public async Task SendMessage(string user, string message)
        {
            var msg = (user, message, DateTime.Now);
            Messages.Add(msg);

            await Clients.All.SendAsync("ReceiveMessage", user, message, msg.Item3);
        }

        public async Task Typing(string username)
        {
            TypingUsers[username] = true;
            await Clients.Others.SendAsync("UserTyping", username);
        }

        public async Task StopTyping(string username)
        {
            TypingUsers.TryRemove(username, out _);
            await Clients.Others.SendAsync("UserStoppedTyping", username);
        }

        private async Task SendUserList()
        {
            var users = Connections.Values.Distinct().OrderBy(u => u).ToList();
            await Clients.All.SendAsync("UserListUpdated", users);
        }
    }
}