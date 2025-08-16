import cors from '@fastify/cors';
import Fastify from 'fastify';
import authRoutes from './src/routes/auth_routes.js';

const fastify = Fastify({
    logger:true
});

fastify.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS']
});

fastify.register(authRoutes, {prefix: "/api/auth"});

fastify.listen({port:3001, host: '0.0.0.0'}, (err, addr) =>{
    if(err){fastify.log.error(err); process.exit(1);}
    console.log(`Backend running on ${addr}`);
});