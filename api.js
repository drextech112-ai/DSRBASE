import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import { MongoClient } from "mongodb"

const app = express()
app.use(cors())
app.use(bodyParser.json())

/* ================= DATABASE ================= */

const MONGO_URL = "mongodb+srv://Demon-slayer:xx26bGZt0ujXdGvQ@cluster0.xmdvwco.mongodb.net/?appName=Cluster0"

if (!MONGO_URL) {
  console.error("❌ MONGO_URL missing")
  process.exit(1)
}

const client = new MongoClient(MONGO_URL)

await client.connect()

const db = client.db("demonSlayer")

console.log("✅ MongoDB Connected")

/* ================= HELPERS ================= */

function cleanDoc(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return rest
}

/* ================= ROUTES ================= */

/* ===== GET DOCUMENT ===== */
app.get("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    const data = await db.collection(collection).findOne({ _id: id })

    if (!data) return res.json({ exists: false })

    res.json({
      exists: true,
      data: cleanDoc(data)
    })
  } catch (err) {
    console.error("GET ERROR:", err)
    res.status(500).json({ error: "GET FAILED" })
  }
})

/* ===== SET (WITH MERGE SUPPORT) ===== */
app.post("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params
    const { data, merge } = req.body

    if (!data) {
      return res.status(400).json({ error: "Missing data" })
    }

    const ref = db.collection(collection)

    if (merge) {
      const old = await ref.findOne({ _id: id })

      const newData = old
        ? { ...old, ...data }
        : { ...data }

      await ref.updateOne(
        { _id: id },
        { $set: { ...newData, _id: id } },
        { upsert: true }
      )
    } else {
      // FULL overwrite like Firebase set()
      await ref.replaceOne(
        { _id: id },
        { ...data, _id: id },
        { upsert: true }
      )
    }

    res.json({ success: true })

  } catch (err) {
    console.error("SET ERROR:", err)
    res.status(500).json({ error: "SET FAILED" })
  }
})

/* ===== UPDATE (PARTIAL UPDATE) ===== */
app.patch("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params
    const { data } = req.body

    if (!data) {
      return res.status(400).json({ error: "Missing data" })
    }

    await db.collection(collection).updateOne(
      { _id: id },
      { $set: data },
      { upsert: false }
    )

    res.json({ success: true })

  } catch (err) {
    console.error("UPDATE ERROR:", err)
    res.status(500).json({ error: "UPDATE FAILED" })
  }
})

/* ===== DELETE (OPTIONAL FIREBASE FEATURE) ===== */
app.delete("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    await db.collection(collection).deleteOne({ _id: id })

    res.json({ success: true })
  } catch (err) {
    console.error("DELETE ERROR:", err)
    res.status(500).json({ error: "DELETE FAILED" })
  }
})

/* ================= START ================= */

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("🚀 API running on port", PORT)
})
