import { migrate } from "./migrate.ts";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida");
const applied = await migrate(url);
console.log(applied.length ? `aplicadas: ${applied.join(", ")}` : "nada a aplicar");
