// ============================================================
// User Store — JSON file-based user management
// ============================================================
import fs from 'fs';
import path from 'path';

export interface User {
    id: string;
    name: string;
    username: string;
    password: string;
    role: 'admin' | 'user';
    avatar?: string;
    bio?: string;
    createdAt: string;
    lastLogin: string | null;
}

const DATA_PATH = path.join(process.cwd(), 'src/data/users.json');

function readUsers(): User[] {
    try {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        return JSON.parse(raw) as User[];
    } catch {
        return [];
    }
}

function writeUsers(users: User[]): void {
    fs.writeFileSync(DATA_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export function getAllUsers(): Omit<User, 'password'>[] {
    return readUsers().map(({ password: _, ...rest }) => rest);
}

export function findByUsername(username: string): User | undefined {
    return readUsers().find(u => u.username === username);
}

export function findByPassword(password: string): User | undefined {
    return readUsers().find(u => u.password === password);
}

export function authenticate(usernameOrPassword: string): User | undefined {
    const users = readUsers();
    // Try username+password combo or legacy password-only
    return users.find(u => u.username === usernameOrPassword || u.password === usernameOrPassword);
}

export function updateLastLogin(userId: string): void {
    const users = readUsers();
    const user = users.find(u => u.id === userId);
    if (user) {
        user.lastLogin = new Date().toISOString();
        writeUsers(users);
    }
}

export function addUser(data: { name: string; username: string; password: string; role: 'admin' | 'user' }): User {
    const users = readUsers();
    if (users.find(u => u.username === data.username)) {
        throw new Error('用户名已存在');
    }
    const newUser: User = {
        id: `user-${Date.now()}`,
        name: data.name,
        username: data.username,
        password: data.password,
        role: data.role,
        createdAt: new Date().toISOString(),
        lastLogin: null,
    };
    users.push(newUser);
    writeUsers(users);
    return newUser;
}

export function deleteUser(userId: string): boolean {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx === -1) return false;
    // Prevent deleting last admin
    if (users[idx].role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
        throw new Error('不能删除最后一个管理员');
    }
    users.splice(idx, 1);
    writeUsers(users);
    return true;
}

export function updateUser(userId: string, data: Partial<Pick<User, 'name' | 'password' | 'role' | 'avatar' | 'bio'>>): User | null {
    const users = readUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    if (data.name) user.name = data.name;
    if (data.password) user.password = data.password;
    if (data.role) user.role = data.role;
    if (data.avatar !== undefined) user.avatar = data.avatar;
    if (data.bio !== undefined) user.bio = data.bio;
    writeUsers(users);
    return user;
}

export function findById(userId: string): User | undefined {
    return readUsers().find(u => u.id === userId);
}
