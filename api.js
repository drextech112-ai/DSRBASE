import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import { MongoClient } from "mongodb"

const app = express()
app.use(cors())
app.use(bodyParser.json())

/* ================= DATABASE ================= */

const MONGO_URL = "mongodb+srv://Demon-slayer:xx26bGZt0ujXdGvQ@cluster0.xmdvwco.mongodb.net/?appName=Cluster0"

const client = new MongoClient(MONGO_URL)
await client.connect()

const db = client.db("demonSlayer")

console.log("✅ MongoDB Connected")

/* ================= HELPERS ================= */

function cleanDoc(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

// 🔥 Firebase-like increment support
function applySpecialFields(old = {}, data = {}) {
  const result = { ...data }

  for (const key in data) {
    if (
      typeof data[key] === "object" &&
      data[key] !== null &&
      data[key].__op === "inc"
    ) {
      result[key] = (old[key] || 0) + data[key].value
    }
  }

  return result
}

/* ================= ROUTES ================= */

/* ===== GET DOC ===== */
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

/* ===== GET ALL DOCS (🔥 NEW) ===== */
app.get("/:collection", async (req, res) => {
  try {
    const { collection } = req.params

    const docs = await db.collection(collection).find().toArray()

    res.json({
      count: docs.length,
      data: docs.map(cleanDoc)
    })

  } catch (err) {
    console.error("GET ALL ERROR:", err)
    res.status(500).json({ error: "GET ALL FAILED" })
  }
})

/* ===== SET DOC (FIREBASE STYLE) ===== */
app.post("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    // 🔥 ACCEPT BOTH FORMATS
    let { data, merge } = req.body

    if (!data) {
      data = req.body // fallback (your current website)
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid data" })
    }

    const ref = db.collection(collection)

    if (merge) {
      const old = await ref.findOne({ _id: id }) || {}

      let newData = {
        ...old,
        ...data
      }

      newData = applySpecialFields(old, newData)

      newData.id = id

      await ref.updateOne(
        { _id: id },
        { $set: newData },
        { upsert: true }
      )

    } else {
      let newData = {
        ...data,
        id: id
      }

      newData = applySpecialFields({}, newData)

      await ref.replaceOne(
        { _id: id },
        newData,
        { upsert: true }
      )
    }

    res.json({ success: true })

  } catch (err) {
    console.error("SET ERROR:", err)
    res.status(500).json({ error: "SET FAILED" })
  }
})

/* ===== UPDATE DOC ===== */
app.patch("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    let { data } = req.body

    if (!data) {
      data = req.body // fallback
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({ error: "Invalid data" })
    }

    const ref = db.collection(collection)

    const old = await ref.findOne({ _id: id }) || {}

    let newData = applySpecialFields(old, data)

    newData.id = id

    await ref.updateOne(
      { _id: id },
      { $set: newData },
      { upsert: false }
    )

    res.json({ success: true })

  } catch (err) {
    console.error("UPDATE ERROR:", err)
    res.status(500).json({ error: "UPDATE FAILED" })
  }
})

/* ===== DELETE DOC ===== */
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
