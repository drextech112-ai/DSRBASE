import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import crypto from "crypto"
import { MongoClient } from "mongodb"

/* ================= CONFIG ================= */

const app = express()

app.disable("x-powered-by")

app.use(cors())
app.use(bodyParser.json({
  limit: "10mb"
}))

app.use(bodyParser.urlencoded({
  extended: true,
  limit: "10mb"
}))

const PORT = process.env.PORT || 3000

/* ================= PROFESSIONAL API KEY ================= */

/*
  🔥 CHANGE THIS TO YOUR OWN PRIVATE KEY
  🔥 NEVER SHARE IT
  🔥 STORE IN HOST ENV VARIABLE IN PRODUCTION
*/

const API_KEY =
  "DSR_9fA7xQwLmP2vNcY8kRtB4sZhE6uJiX3mAaT1oP==CREATED-BY-DREXMOND"

/* ================= DATABASE ================= */

const MONGO_URL =
  process.env.MONGO_URL ||
  "mongodb+srv://Demon-slayer:xx26bGZt0ujXdGvQ@cluster0.xmdvwco.mongodb.net/?appName=Cluster0"

const client = new MongoClient(MONGO_URL, {
  maxPoolSize: 50,
  minPoolSize: 5,
  retryWrites: true,
  retryReads: true
})

await client.connect()

const db = client.db("demonSlayer")

console.log("✅ MongoDB Connected")

/* ================= PROFESSIONAL CACHE SYSTEM ================= */

/*
  🔥 HIGH SPEED MEMORY CACHE
  🔥 REDUCES DATABASE LOAD
  🔥 MAKES API MUCH FASTER
*/

const CACHE = new Map()

const CACHE_TTL = 1000 * 60 * 5 // 5 MINUTES

function getCacheKey(collection, id = "ALL") {
  return `${collection}:${id}`
}

function setCache(key, value) {
  CACHE.set(key, {
    value,
    expiry: Date.now() + CACHE_TTL
  })
}

function getCache(key) {
  const cached = CACHE.get(key)

  if (!cached) return null

  if (Date.now() > cached.expiry) {
    CACHE.delete(key)
    return null
  }

  return cached.value
}

function deleteCache(collection, id) {
  CACHE.delete(getCacheKey(collection, id))
  CACHE.delete(getCacheKey(collection))
}

setInterval(() => {
  const now = Date.now()

  for (const [key, value] of CACHE.entries()) {
    if (now > value.expiry) {
      CACHE.delete(key)
    }
  }
}, 60000)

/* ================= SECURITY ================= */

/*
  🔥 STRICT API KEY VALIDATION
  🔥 NO ACCESS WITHOUT KEY
  🔥 BLOCKS SCRAPERS/BYPASS ATTEMPTS
*/

function secureCompare(a, b) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)

  if (bufferA.length !== bufferB.length) {
    return false
  }

  return crypto.timingSafeEqual(bufferA, bufferB)
}

function apiKeyMiddleware(req, res, next) {
  try {
    const providedKey =
      req.headers["x-api-key"] ||
      req.headers["authorization"]?.replace("Bearer ", "") ||
      req.query.api_key

    // ================= DEBUG =================
    console.log("============== API AUTH DEBUG ==============");
    console.log("Expected:", JSON.stringify(API_KEY));
    console.log("Received:", JSON.stringify(providedKey));
    console.log("Expected Length:", API_KEY.length);
    console.log("Received Length:", providedKey?.length);
    console.log("Equal:", providedKey === API_KEY);
    console.log("Headers:", req.headers);
    console.log("============================================");
    // =========================================

    if (!providedKey) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: "FORBIDDEN - SECURED BY DEXA XD - SYSTEM"
      })
    }

    const isValid = secureCompare(
      String(providedKey),
      String(API_KEY)
    )

    if (!isValid) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: "FORBIDDEN - SECURED BY DEXA - XD SYSTEM"
      })
    }

    next()

  } catch (err) {
    return res.status(403).json({
      success: false,
      status: 403,
      message: "FORBIDDEN - SECURED BY DEXA - XD SYSTEM"
    })
  }
}

app.use(apiKeyMiddleware)

/* ================= RATE LIMIT (ANTI-SPAM) ================= */

const requests = new Map()

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 120

function rateLimit(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown"

  const now = Date.now()

  if (!requests.has(ip)) {
    requests.set(ip, [])
  }

  const timestamps = requests
    .get(ip)
    .filter(time => now - time < RATE_LIMIT_WINDOW)

  timestamps.push(now)

  requests.set(ip, timestamps)

  if (timestamps.length > RATE_LIMIT_MAX) {
    return res.status(429).json({
      success: false,
      message: "Too many requests"
    })
  }

  next()
}

app.use(rateLimit)

/* ================= HELPERS ================= */

function cleanDoc(doc) {
  if (!doc) return null

  const { _id, ...rest } = doc

  return {
    id: _id,
    ...rest
  }
}

function applySpecialFields(old = {}, data = {}) {
  const result = { ...data }

  for (const key in data) {
    if (
      typeof data[key] === "object" &&
      data[key] !== null &&
      data[key].__op === "inc"
    ) {
      result[key] =
        Number(old[key] || 0) +
        Number(data[key].value || 0)
    }
  }

  return result
}

function validateInput(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length < 200
  )
}

/* ================= HEALTH CHECK ================= */

app.get("/", async (req, res) => {
  res.json({
    success: true,
    name: "DEXA - XD SYSTEM - DSR API",
    status: "ONLINE",
    secured: true,
    cache: true
  })
})

/* ================= GET SINGLE DOC ================= */

app.get("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    if (
      !validateInput(collection) ||
      !validateInput(id)
    ) {
      return res.status(400).json({
        error: "Invalid parameters"
      })
    }

    const cacheKey = getCacheKey(collection, id)

    const cached = getCache(cacheKey)

    if (cached) {
      return res.json({
        cached: true,
        exists: true,
        data: cached
      })
    }

    const data = await db
      .collection(collection)
      .findOne({ _id: id })

    if (!data) {
      return res.json({
        exists: false
      })
    }

    const cleaned = cleanDoc(data)

    setCache(cacheKey, cleaned)

    res.json({
      cached: false,
      exists: true,
      data: cleaned
    })

  } catch (err) {
    console.error("GET ERROR:", err)

    res.status(500).json({
      error: "GET FAILED"
    })
  }
})

/* ================= GET ALL DOCS ================= */

app.get("/:collection", async (req, res) => {
  try {
    const { collection } = req.params

    if (!validateInput(collection)) {
      return res.status(400).json({
        error: "Invalid collection"
      })
    }

    const cacheKey = getCacheKey(collection)

    const cached = getCache(cacheKey)

    if (cached) {
      return res.json({
        cached: true,
        count: cached.length,
        data: cached
      })
    }

    const docs = await db
      .collection(collection)
      .find()
      .toArray()

    const cleaned = docs.map(cleanDoc)

    setCache(cacheKey, cleaned)

    res.json({
      cached: false,
      count: cleaned.length,
      data: cleaned
    })

  } catch (err) {
    console.error("GET ALL ERROR:", err)

    res.status(500).json({
      error: "GET ALL FAILED"
    })
  }
})

/* ================= CREATE / SET DOC ================= */

app.post("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    if (
      !validateInput(collection) ||
      !validateInput(id)
    ) {
      return res.status(400).json({
        error: "Invalid parameters"
      })
    }

    let { data, merge } = req.body

    if (!data) {
      data = req.body
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        error: "Invalid data"
      })
    }

    const ref = db.collection(collection)

    if (merge) {
      const old =
        await ref.findOne({ _id: id }) || {}

      let newData = {
        ...old,
        ...data
      }

      newData = applySpecialFields(
        old,
        newData
      )

      newData.id = id

      await ref.updateOne(
        { _id: id },
        {
          $set: newData
        },
        {
          upsert: true
        }
      )

    } else {
      let newData = {
        ...data,
        id
      }

      newData = applySpecialFields(
        {},
        newData
      )

      await ref.replaceOne(
        { _id: id },
        newData,
        {
          upsert: true
        }
      )
    }

    deleteCache(collection, id)

    res.json({
      success: true
    })

  } catch (err) {
    console.error("SET ERROR:", err)

    res.status(500).json({
      error: "SET FAILED"
    })
  }
})

/* ================= UPDATE DOC ================= */

app.patch("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    if (
      !validateInput(collection) ||
      !validateInput(id)
    ) {
      return res.status(400).json({
        error: "Invalid parameters"
      })
    }

    let { data } = req.body

    if (!data) {
      data = req.body
    }

    if (!data || typeof data !== "object") {
      return res.status(400).json({
        error: "Invalid data"
      })
    }

    const ref = db.collection(collection)

    const old =
      await ref.findOne({ _id: id }) || {}

    let newData = applySpecialFields(
      old,
      data
    )

    newData.id = id

    await ref.updateOne(
      { _id: id },
      {
        $set: newData
      },
      {
        upsert: false
      }
    )

    deleteCache(collection, id)

    res.json({
      success: true
    })

  } catch (err) {
    console.error("UPDATE ERROR:", err)

    res.status(500).json({
      error: "UPDATE FAILED"
    })
  }
})

/* ================= DELETE DOC ================= */

app.delete("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params

    if (
      !validateInput(collection) ||
      !validateInput(id)
    ) {
      return res.status(400).json({
        error: "Invalid parameters"
      })
    }

    await db
      .collection(collection)
      .deleteOne({ _id: id })

    deleteCache(collection, id)

    res.json({
      success: true
    })

  } catch (err) {
    console.error("DELETE ERROR:", err)

    res.status(500).json({
      error: "DELETE FAILED"
    })
  }
})

/* ================= 404 ================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found"
  })
})

/* ================= START ================= */

app.listen(PORT, () => {
  console.log(`🚀 Demon Slayer Reincarnated API V1 running on port ${PORT}`)
  console.log("🔐 DEXA - XD SYSTEM Security Enabled")
  console.log("⚡ High Speed Cache/Response Enabled")
})
