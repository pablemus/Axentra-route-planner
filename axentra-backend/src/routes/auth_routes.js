import { Login, Register, VerifyToken } from "../controllers/auth_controller.js";

export default async function authRoutes(fastify, options) {
    fastify.post('/register', Register);
    fastify.post('/login', Login);
    fastify.post('/verify', VerifyToken);
}