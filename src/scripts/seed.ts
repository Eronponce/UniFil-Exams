import { migrate } from "../lib/db/schema";
import { seed } from "../lib/db/seed";

migrate();
seed();
console.log("Seed concluído.");
