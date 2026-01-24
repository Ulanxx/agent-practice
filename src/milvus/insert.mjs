import "dotenv/config";
import {
  MilvusClient,      // Milvus 客户端，用于连接和操作向量数据库
  DataType,          // 数据类型枚举，定义字段可以存储的数据类型
  MetricType,        // 距离度量类型，定义向量相似度计算方式
  IndexType,         // 索引类型枚举，定义向量索引的构建算法
} from "@zilliz/milvus2-sdk-node";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Milvus2 核心概念说明：
 * 
 * 1. Collection（集合）：类似关系型数据库中的"表"，是存储向量的容器
 *    - 一个 Collection 包含多个 Field（字段）
 *    - 每个 Collection 有唯一的名称
 * 
 * 2. Field（字段）：类似表中的"列"，定义数据的结构和类型
 *    - 主键字段（primary key）：唯一标识每条记录
 *    - 向量字段（vector）：存储 embedding 向量，用于相似度搜索
 *    - 标量字段：存储普通数据（字符串、数字、数组等）
 * 
 * 3. DataType（数据类型）：
 *    - VarChar：变长字符串，用于文本、ID 等
 *    - FloatVector：浮点向量，用于存储 embedding
 *    - Array：数组类型，可存储多个相同类型的元素
 * 
 * 4. Index（索引）：加速向量搜索的数据结构
 *    - 向量必须创建索引后才能进行高效搜索
 *    - 不同的索引类型适合不同的场景
 * 
 * 5. MetricType（距离度量）：计算向量相似度的方式
 *    - COSINE：余弦相似度，最常用的度量方式
 *    - L2：欧几里得距离
 *    - IP：内积
 * 
 * 6. Embedding（嵌入）：将文本转换为高维向量
 *    - 语义相似的文本会有相似的向量
 *    - 向量间的距离反映了语义相似度
 */

const COLLECTION_NAME = "ai_diary";  // 集合名称，类似表名
const VECTOR_DIM = 1024;              // 向量维度，OpenAI embedding 的维度

/**
 * 创建 OpenAI Embeddings 实例
 * 
 * Embedding（嵌入）是将文本转换为数值向量的过程
 * 例如："今天心情很好" → [0.12, -0.34, 0.56, ...] (1024维向量)
 * 
 * Milvus 使用这些向量来计算语义相似度
 * 语义相似的文本，其向量在空间中的距离也更近
 */
const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
});

/**
 * 初始化 Milvus 客户端
 * 
 * Milvus 是一个开源的向量数据库，用于存储和搜索大规模向量数据
 * 默认地址 localhost:19530 是 Milvus 的 gRPC 端口
 * 
 * 工作流程：
 * 1. 连接 Milvus 服务器
 * 2. 创建 Collection（定义数据结构）
 * 3. 创建 Index（加速搜索）
 * 4. 加载 Collection 到内存
 * 5. 插入数据（向量 + 标量数据）
 * 6. 执行向量搜索
 */
const client = new MilvusClient({
  address: "localhost:19530",  // Milvus 服务器地址
});

/**
 * 将文本转换为向量
 * 
 * 这是向量数据库的核心流程：
 * 1. 用户输入文本
 * 2. 调用 Embedding API（如 OpenAI）转换为向量
 * 3. 将向量存入 Milvus
 * 
 * 搜索时：
 * 1. 将查询文本转换为向量
 * 2. Milvus 计算该向量与库中向量的相似度
 * 3. 返回最相似的记录
 */
async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text);
  return result;
}

async function main() {
  try {
    console.log("Connecting to Milvus...");
    await client.connectPromise;
    console.log("✓ Connected\n"); // 创建集合

    /**
     * 创建 Collection（集合）
     * 
     * Collection 是 Milvus 中存储数据的基本单位，类似关系型数据库的"表"
     * 这里定义了一个 "ai_diary" 集合，包含以下字段：
     * 
     * 字段说明：
     * 1. id (VarChar)：主键，日记的唯一标识
     * 2. vector (FloatVector)：向量字段，存储文本的 embedding
     * 3. content (VarChar)：日记内容文本
     * 4. date (VarChar)：日期
     * 5. mood (VarChar)：心情标签
     * 6. tags (Array)：标签数组，最多存储10个标签
     */
    console.log("Creating collection...");
    await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: "id",
          data_type: DataType.VarChar,
          max_length: 50,
          is_primary_key: true,  // 标记为主键，用于唯一标识每条记录
        },
        { name: "vector", data_type: DataType.FloatVector, dim: VECTOR_DIM },
        { name: "content", data_type: DataType.VarChar, max_length: 5000 },
        { name: "date", data_type: DataType.VarChar, max_length: 50 },
        { name: "mood", data_type: DataType.VarChar, max_length: 50 },
        {
          name: "tags",
          data_type: DataType.Array,        // Array 类型，可存储多个元素
          element_type: DataType.VarChar,   // 数组元素类型是字符串
          max_capacity: 10,                // 最多存储 10 个标签
          max_length: 50,
        },
      ],
    });
    console.log("Collection created"); // 创建索引

    /**
     * 创建向量索引（Index）
     * 
     * 索引是加速向量搜索的关键数据结构
     * 向量字段必须创建索引后才能进行高效的相似度搜索
     * 
     * 参数说明：
     * - field_name: "vector" - 指定为向量字段创建索引
     * - index_type: IVF_FLAT - 索引类型
     *   * IVF_FLAT：精确搜索，速度较慢但结果精确
     *   * HNSW：图索引，搜索快但可能略有不精确
     *   * IVF_SQ8：压缩索引，节省内存
     * - metric_type: COSINE - 使用余弦相似度计算向量距离
     *   * 余弦相似度范围 [-1, 1]，越接近 1 表示越相似
     * - params.nlist: 1024 - 索引的聚类数量，值越大索引越精确但占用内存越多
     */
    console.log("\nCreating index...");
    await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: "vector",
      index_type: IndexType.IVF_FLAT,   // IVF_FLAT 是最常用的索引类型
      metric_type: MetricType.COSINE,   // 余弦相似度，适合语义搜索
      params: { nlist: 1024 },           // 聚类中心数量
    });
    console.log("Index created"); // 加载集合

    /**
     * 加载 Collection 到内存
     * 
     * Milvus 默认将数据存储在磁盘上，搜索时需要将数据加载到内存
     * 这个过程类似于关系型数据库的"预加载"或"缓存"
     * 
     * 重要：搜索前必须调用 loadCollection，否则无法查询
     * 对于大规模数据，可以只加载部分分片来节省内存
     */
    console.log("\nLoading collection...");
    await client.loadCollection({ collection_name: COLLECTION_NAME });
    console.log("Collection loaded"); // 插入日记数据

    /**
     * 准备日记数据并生成向量
     * 
     * 数据结构说明：
     * - id: 每条记录的唯一标识（主键）
     * - vector: OpenAI 生成的 1024 维向量
     * - content: 日记文本内容
     * - date: 日期字符串
     * - mood: 心情标签
     * - tags: 标签数组
     * 
     * 注意：向量字段的值需要通过 OpenAI Embedding API 生成
     * 语义相似的文本会产生相似的向量
     */
    console.log("\nInserting diary entries...");
    const diaryContents = [
      {
        id: "diary_001",
        content:
          "今天天气很好，去公园散步了，心情愉快。看到了很多花开了，春天真美好。",
        date: "2026-01-10",
        mood: "happy",
        tags: ["生活", "散步"],
      },
      {
        id: "diary_002",
        content:
          "今天工作很忙，完成了一个重要的项目里程碑。团队合作很愉快，感觉很有成就感。",
        date: "2026-01-11",
        mood: "excited",
        tags: ["工作", "成就"],
      },
      {
        id: "diary_003",
        content:
          "周末和朋友去爬山，天气很好，心情也很放松。享受大自然的感觉真好。",
        date: "2026-01-12",
        mood: "relaxed",
        tags: ["户外", "朋友"],
      },
      {
        id: "diary_004",
        content:
          "今天学习了 Milvus 向量数据库，感觉很有意思。向量搜索技术真的很强大。",
        date: "2026-01-12",
        mood: "curious",
        tags: ["学习", "技术"],
      },
      {
        id: "diary_005",
        content:
          "晚上做了一顿丰盛的晚餐，尝试了新菜谱。家人都说很好吃，很有成就感。",
        date: "2026-01-13",
        mood: "proud",
        tags: ["美食", "家庭"],
      },
    ];

    console.log("Generating embeddings...");
    const diaryData = await Promise.all(
      diaryContents.map(async (diary) => ({
        ...diary,
        vector: await getEmbedding(diary.content),  // 为每条日记生成向量
      })),
    );

    /**
     * 插入数据到 Milvus
     * 
     * insert 操作将数据写入 Milvus：
     * - 标量数据（id, content, date, mood, tags）存储在列式存储中
     * - 向量数据（vector）存储在专门的向量索引中
     * 
     * 返回结果包含 insert_cnt，表示成功插入的记录数
     */
    const insertResult = await client.insert({
      collection_name: COLLECTION_NAME,
      data: diaryData,  // 包含向量和标量数据的完整记录
    });
    console.log(`✓ Inserted ${insertResult.insert_cnt} records\n`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
