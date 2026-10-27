import type { Product } from "@/services/products"

const rawBase = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/"
const base = rawBase.endsWith("/") ? rawBase.slice(0, -1) : rawBase

/**
 * Normalizes an asset path to include Vite's base URL.
 */
export const getAssetUrl = (path: string): string => {
  if (!path) return ""
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) return path
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${base}${normalized}`
}

export interface ProductCategoryDef {
  id: string
  name: string
  shortName: string
  image: string
  badgeClass: string
  borderClass: string
  keywords: string[]
}

export const PRODUCT_CATEGORIES: ProductCategoryDef[] = [
  {
    id: "all",
    name: "All Products",
    shortName: "All",
    image: getAssetUrl("/favicon.svg"),
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    borderClass: "border-blue-500",
    keywords: [],
  },
  {
    id: "honey",
    name: "Honey",
    shortName: "Honey",
    image: getAssetUrl("/images/categories/honey.jpg"),
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    borderClass: "border-amber-500",
    keywords: ["honey", "sider", "jamun", "black forest", "multiflora", "multifora", "accia", "acacia", "raw honey", "shehd"],
  },
  {
    id: "oils",
    name: "Oils",
    shortName: "Oils",
    image: getAssetUrl("/images/categories/oils.jpg"),
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    borderClass: "border-emerald-500",
    keywords: ["oil", "zaitoon", "kalonji", "kalong", "olive", "mustard", "sarson", "tel"],
  },
  {
    id: "dry_fruits",
    name: "Dry Fruits & Nuts",
    shortName: "Dry Fruits",
    image: getAssetUrl("/images/categories/dry-fruits.jpg"),
    badgeClass: "bg-orange-50 text-orange-800 border-orange-200",
    borderClass: "border-orange-500",
    keywords: [
      "walnut",
      "giri",
      "almond",
      "badam",
      "pista",
      "pistachio",
      "cashew",
      "kaju",
      "kishmish",
      "raisin",
      "nutmix",
      "nuts",
      "dry fruit",
    ],
  },
  {
    id: "dates",
    name: "Dates",
    shortName: "Dates",
    image: getAssetUrl("/images/categories/dates.jpg"),
    badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
    borderClass: "border-rose-500",
    keywords: ["date", "dates", "khajoor", "khajur", "ajwa", "toffee", "dates toffee", "mabroom", "safawi"],
  },
  {
    id: "baby",
    name: "Baby Products",
    shortName: "Baby",
    image: getAssetUrl("/images/categories/baby.jpg"),
    badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
    borderClass: "border-sky-500",
    keywords: ["baby", "diaper", "wipes", "pampers", "teddy diaper", "lotion", "infant"],
  },
  {
    id: "perfumes",
    name: "Attar & Perfumes",
    shortName: "Perfumes",
    image: getAssetUrl("/images/categories/perfumes.jpg"),
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    borderClass: "border-purple-500",
    keywords: ["attar", "perfume", "itr", "oud", "fragrance", "scent", "musk"],
  },
  {
    id: "spices",
    name: "Spices & Masalas",
    shortName: "Spices",
    image: getAssetUrl("/images/categories/spices.jpg"),
    badgeClass: "bg-red-50 text-red-800 border-red-200",
    borderClass: "border-red-500",
    keywords: [
      "saffron",
      "kesar",
      "zafran",
      "spice",
      "masala",
      "haldi",
      "turmeric",
      "chilli",
      "mirch",
      "jeera",
      "cumin",
      "cardamom",
      "elaichi",
      "clove",
      "laung",
      "cinnamon",
      "dalchini",
      "pepper",
    ],
  },
  {
    id: "grocery",
    name: "Grocery & Food",
    shortName: "Grocery",
    image: getAssetUrl("/images/categories/grocery.jpg"),
    badgeClass: "bg-teal-50 text-teal-800 border-teal-200",
    borderClass: "border-teal-500",
    keywords: ["grocery", "tea", "chai", "coffee", "rice", "flour", "atta", "sugar", "salt", "pulse", "dal", "ghee", "vinegar", "food"],
  },
  {
    id: "other",
    name: "Other Products",
    shortName: "Other",
    image: getAssetUrl("/favicon.svg"),
    badgeClass: "bg-slate-50 text-slate-700 border-slate-200",
    borderClass: "border-slate-400",
    keywords: [],
  },
]

/**
 * The 9 canonical business categories for product assignment in forms and business logic.
 * Excludes the 'all' filter-only browsing option.
 */
export const BUSINESS_CATEGORIES: ProductCategoryDef[] = PRODUCT_CATEGORIES.filter(
  (c) => c.id !== "all"
)

/**
 * Resolves the business category for a product.
 * Respects product.category if set in database; otherwise infers from product name.
 * Falls back to "Other Products" as required.
 */
export function getProductCategory(product: { name: string; category?: string | null }): ProductCategoryDef {
  // If explicitly assigned in data
  if (product.category && product.category.trim()) {
    const rawCat = product.category.trim().toLowerCase()
    const found = PRODUCT_CATEGORIES.find(
      (c) =>
        c.id !== "all" &&
        (c.name.toLowerCase() === rawCat ||
          c.shortName.toLowerCase() === rawCat ||
          c.id.toLowerCase() === rawCat)
    )
    if (found) return found
  }

  // Infer from name keywords
  const lowerName = product.name.toLowerCase()

  for (const cat of PRODUCT_CATEGORIES) {
    if (cat.id === "all" || cat.id === "other") continue
    if (cat.keywords.some((kw) => lowerName.includes(kw))) {
      return cat
    }
  }

  // Fallback to "Other Products"
  return PRODUCT_CATEGORIES.find((c) => c.id === "other")!
}

/**
 * Returns the best image asset URL for a product.
 */
export function getProductImageUrl(product: { name: string; image_url?: string | null; category?: string | null }): string {
  if (product.image_url) return product.image_url

  const lower = product.name.toLowerCase()

  // Match specific showcase product photos
  if (lower.includes("saffron") || lower.includes("kesar")) {
    return getAssetUrl("/images/products/saffron.jpg")
  }
  if (lower.includes("black forest")) {
    return getAssetUrl("/images/products/dark-forest-honey.jpg")
  }
  if (lower.includes("diaper") || lower.includes("teddy")) {
    return getAssetUrl("/images/products/teddy-diaper.jpg")
  }
  if (lower.includes("honey") || lower.includes("accia") || lower.includes("sider") || lower.includes("jamun")) {
    return getAssetUrl("/images/categories/honey.jpg")
  }
  if (lower.includes("oil") || lower.includes("zaitoon") || lower.includes("kalong")) {
    return getAssetUrl("/images/categories/oils.jpg")
  }
  if (lower.includes("date") || lower.includes("toffee")) {
    return getAssetUrl("/images/categories/dates.jpg")
  }
  if (lower.includes("walnut") || lower.includes("almond") || lower.includes("giri") || lower.includes("nut")) {
    return getAssetUrl("/images/categories/dry-fruits.jpg")
  }

  // Fallback to category image
  const category = getProductCategory(product)
  return category.image || getAssetUrl("/favicon.svg")
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock"

export const LOW_STOCK_THRESHOLD = 2

export function getProductStockStatus(stock: number): {
  status: StockStatus
  label: string
  colorClass: string
  dotClass: string
  badgeClass: string
} {
  if (stock <= 0) {
    return {
      status: "out_of_stock",
      label: "Out of Stock",
      colorClass: "text-[#DC2626]",
      dotClass: "bg-[#DC2626]",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    }
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      status: "low_stock",
      label: "Low Stock",
      colorClass: "text-[#D97706]",
      dotClass: "bg-[#D97706]",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    }
  }
  return {
    status: "in_stock",
    label: "In Stock",
    colorClass: "text-[#059669]",
    dotClass: "bg-[#059669]",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  }
}

export interface InventoryAggregates {
  totalProducts: number
  totalStockValue: number
  lowStockCount: number
  outOfStockCount: number
  inStockCount: number
}

export function calculateInventoryAggregates(products: Product[]): InventoryAggregates {
  let totalStockValue = 0
  let lowStockCount = 0
  let outOfStockCount = 0
  let inStockCount = 0

  for (const p of products) {
    const stock = Number(p.stock_quantity) || 0
    const cost = Number(p.buying_cost) || 0
    totalStockValue += Math.max(0, stock) * cost

    if (stock <= 0) {
      outOfStockCount += 1
    } else if (stock <= LOW_STOCK_THRESHOLD) {
      lowStockCount += 1
    } else {
      inStockCount += 1
    }
  }

  return {
    totalProducts: products.length,
    totalStockValue,
    lowStockCount,
    outOfStockCount,
    inStockCount,
  }
}
