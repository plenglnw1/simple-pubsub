## แนวคิดที่ผมใช้ทำ Pub/Sub (สั้นๆ)

จากที่ผมได้ไปอ่าน Pub/Sub Implement หลายๆ แบบ ก็เจอว่าของอันนี้ มีการแยก Service แยก Interface ที่หลาย Layer กว่ามาก (เช่น บางทีเก็บ Event หรือ Topic ไว้ใน PubSub เลย และก็ไม่ได้แยกตัว Subscriber ออกมา แต่เขียนเป็น PubSub Class เดียวเลย แล้วใช้ Dict <id, Event[]> ไปเลย) ดังนั้นแรกๆ ผมจึงออกแบบโดยให้ `PublishSubscribeService` ให้เก็บ subscriber เป็น `Map<eventType, subscribers[]>` เพื่อให้ subscribe/unsubscribe ตาม type ได้ง่าย และตอน publish ก็เรียก handler ทุกตัวของ type นั้น


และเพื่อให้ตรง Note I (event ใหม่ต้องถูก handle หลัง event เดิม) ผมใช้ `_eventQueue` แบบ FIFO และมี `_isPublishing` กันการ publish ซ้อน ทำให้ event ที่ถูกสร้างเพิ่มระหว่าง handle จะถูกต่อท้ายคิวและประมวลผลตามลำดับที่เกิดจริง

ฝั่ง business logic ผมแยก subscriber ตามหน้าที่:
- `MachineSaleSubscriber` / `MachineRefillSubscriber` ทำแค่ปรับ stock ของ machine
- `StockWarningSubscriber` ตรวจ threshold stock < 3 และสร้าง `LowStockWarningEvent` / `StockLevelOkEvent` โดยยิงแค่ตอน “cross 3” เท่านั้น (เก็บ state boolean ต่อ machine)
- `StockLoggerSubscriber` เอาไว้ handle event ใหม่เพื่อแสดงผล/ตรวจสอบใน console