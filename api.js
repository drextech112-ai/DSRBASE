import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import { MongoClient } from "mongodb"

const app = express()
app.use(cors())
app.use(bodyParser.json())

/* ================= DATABASE ================= */

const MONGO_URL = process.env.MONGO_URL

const client = new MongoClient(MONGO_URL)
await client.connect()

const db = client.db("demonSlayer")

console.log("✅ MongoDB Connected")

/* ================= ROUTES ================= */

app.get("/:collection/:id", async (req, res) => {
  const { collection, id } = req.params

  const data = await db.collection(collection).findOne({ _id: id })

  if (!data) return res.json({ exists: false })

  res.json({ exists: true, data })
})

app.post("/:collection/:id", async (req, res) => {
  const { collection, id } = req.params

  await db.collection(collection).updateOne(
    { _id: id },
    { $set: { ...req.body, _id: id } },
    { upsert: true }
  )

  res.json({ success: true })
})

app.patch("/:collection/:id", async (req, res) => {
  const { collection, id } = req.params

  await db.collection(collection).updateOne(
    { _id: id },
    { $set: req.body }
  )

  res.json({ success: true })
})

/* ================= START ================= */

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("🚀 API running on port", PORT)
})
