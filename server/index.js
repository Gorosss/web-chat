import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createClient } from '@supabase/supabase-js'; // Importa createClient desde supabase

dotenv.config();

const port = process.env.PORT || 3000;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:8081', // Permitir solicitudes desde localhost:8081
    methods: ['GET', 'POST'] // Permitir los métodos GET y POST
  }
});

const supabase = createClient(
  'https://trdtclxixupyonmhfpbx.supabase.co',  process.env.DB_TOKEN_WEB_CHAT
);

io.on('connection', async (socket) => {
  console.log('a user has connected!');

  socket.on('disconnect', () => {
    console.log('an user has disconnected');
  });

  socket.on('chat message', async (msg) => {
    let result;
    const username = socket.handshake.auth.username ?? 'anonymous';
    console.log({ username });
    try {
      // Inserta el mensaje en Supabase
      const { data, error } = await supabase
        .from('messages')
        .insert([{ content: msg, user: username }]);
      if (error) {
        throw error;
      }
      result = data[0];
    } catch (e) {
      console.error(e);
      return;
    }
    console.log(msg,result)
    io.emit('chat message', msg, result.id.toString(), username);
  });

  if (!socket.recovered) {
    let groupMessages = [];
    try {
      // Obtener los IDs de los grupos en los que el usuario está presente

      const userGroupsIds = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', socket.handshake.auth.userId); // Supongamos que `userId` es el ID del usuario autenticado
      

      if (userGroupsIds.error) {
          throw userGroupsIds.error;
      }
      
      // Recorrer cada grupo y recuperar sus mensajes
      for (const group of userGroupsIds.data) {
          const groupId = group.group_id;

          // Recuperar los mensajes del grupo actual
          const messages = await supabase
              .from('messages')
              .select('id, content, user_id, group_id, users (username)')
              .eq('group_id', groupId)
              .gt('id', socket.handshake.auth.serverOffset ?? 0);
  

          if (messages.error) {
              throw messages.error;
          }

          groupMessages.push(messages.data);
           
      }

      const highestId = groupMessages.reduce((maxId, message) => {
        return message.id > maxId ? message.id : maxId;
      }, 0);
      
        socket.emit('chat message', groupMessages, highestId.toString(),socket.handshake.auth.userId);
    
  } catch (error) {
      console.error('Error al recuperar los mensajes de los grupos:', error);
  }
  }
});

app.use(logger('dev'));

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html');
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
