import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getUserByEmail = async (email) =>{
    const user = await prisma.users.findUnique({
                where: {Email: email},
            });
    return user;
}