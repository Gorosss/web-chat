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
  'https://trdtclxixupyonmhfpbx.supabase.co', process.env.DB_TOKEN_WEB_CHAT
);

io.on('connection', async (socket) => {
  console.log('a user has connected!');

  socket.on('disconnect', () => {
    console.log('an user has disconnected');
  });

  socket.on('create group', async (groupName, groupPassword, userId) => {
    let resInsert;
    console.log({ groupName, groupPassword, userId });
    try {
      // Inserta el grupo en Supabase
      resInsert = await supabase
        .from('groups')
        .upsert([{ name: groupName, password: groupPassword }])
        .select('id');

      if (resInsert.error) {
        throw resInsert.error;
      }

      const res = await supabase
        .from('group_members')
        .insert([{ user_id: userId, group_id: resInsert.data[0].id }]);


      if (res.error) {
        throw res.error;
      }

    } catch (e) {
      console.error(e);
      return;
    }
    io.emit('create group', {groupId:resInsert.data[0].id   , groupName:groupName  ,messages: []});
  });

  socket.on('join group', async (groupName, groupPassword, userId) => {
    let result;
    let groupId;
    console.log({ groupName, groupPassword, userId });
    try {


      const newGroup = await supabase
        .from('groups')
        .select('id')
        .eq('name', groupName)
        .eq('password', groupPassword);

      
      if (newGroup.error) {
        throw newGroup.error;
      }

      groupId = newGroup.data[0].id;
      const res = await supabase
        .from('group_members')
        .insert([{ user_id: userId, group_id: groupId  }]);



      if (res.error) {
        throw res.error;
      }

        result = await supabase
        .from('messages')
        .select('id, content, user_id, users (username)')
        .eq('group_id', groupId );

      if (result.error) {
        throw result.error;
      }


    } catch (e) {
      console.error(e);
      return;
    }

    io.emit('join group', {groupId:groupId   , groupName:groupName  ,messages: result.data});
  });

  socket.on('leave group', async (groupId, userId) => {
  
    try {
      const res = await supabase
        .from('group_members')
        .delete()
        .eq('user_id', userId)
        .eq('group_id', groupId);

      if (res.error) {
        throw res.error;
      }

    } catch (e) {
      console.error(e);
      return;
    }

    io.emit('leave group', groupId);
  
  
  });


  socket.on('chat new message', async (msg, group_id, userId, groupMessagesEdit) => {
    let result;
    const username = socket.handshake.auth.username ?? 'anonymous';
    try {
      // Inserta el mensaje en Supabase
      const { data, error } = await supabase
        .from('messages')
        .upsert([{ content: msg, user_id: userId, group_id: group_id }])
        .select();

      if (error) {
        throw error;
      }
      result = data[0];
    } catch (e) {
      console.error(e);
      return;
    }
    io.emit('chat new message', { group_id: group_id, content: msg, user_id: userId, id: result.id }, result.id.toString(), username, groupMessagesEdit);
  });

  if (!socket.recovered) {
    let groupMessages = [];
    try {
      // Obtener los IDs de los grupos en los que el usuario está presente

      const userGroups = await supabase
        .from('group_members')
        .select('group_id, groups (name) as groupName')
        .eq('user_id', socket.handshake.auth.userId); // Supongamos que `userId` es el ID del usuario autenticado


      if (userGroups.error) {
        throw userGroups.error;
      }

      const formattedUserGroups = userGroups.data.map(group => {
        return {
          group_id: group.group_id,
          groupName: group.groups.name
        };
      });

      // Recorrer cada grupo y recuperar sus mensajes
      for (const group of formattedUserGroups) {
        const groupId = group.group_id;

        // Recuperar los mensajes del grupo actual
        const messages = await supabase
          .from('messages')
          .select('id, content, user_id, users (username)')
          .eq('group_id', groupId)
          .gt('id', socket.handshake.auth.serverOffset ?? 0);


        if (messages.error) {
          throw messages.error;
        }



        groupMessages.push({ groupId: groupId, groupName: group.groupName, messages: messages.data });

      }

      const highestId = groupMessages.reduce((maxId, message) => {
        return message.id > maxId ? message.id : maxId;
      }, 0);

      socket.emit('chat message', groupMessages, highestId.toString(), socket.handshake.auth.userId);

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
