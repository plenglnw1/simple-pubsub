// interfaces
interface IEvent {
  type(): string;
  machineId(): string;
}

interface ISubscriber {
  // handle(event: IEvent, pubSubService: IPublishSubscribeService): void;
  handle(event: IEvent): IEvent[] | IEvent | void;
  addMachine(machine: Machine): void;
  removeMachine(machine: Machine): void;
  // createEvent(pubSubService: IPublishSubscribeService, event: IEvent): void;
}

interface IPublishSubscribeService {
  publish(event: IEvent): void;
  subscribe(type: string, handler: ISubscriber): void;
  unsubscribe(type: string, handler: ISubscriber): void;
}

class PublishSubscribeService implements IPublishSubscribeService {
  private readonly _subscribers: Map<string, ISubscriber[]>;
  private readonly _eventQueue: IEvent[] = [];
  private _isPublishing = false;

  constructor() {
    this._subscribers = new Map<string, ISubscriber[]>();
  }

  // publish an event based on IEvent
  publish(event: IEvent): void {
    this._eventQueue.push(event);

    if (this._isPublishing) return;

    this._isPublishing = true;

    // Note I: The events would get handled after all existing events are handled
    // implement FIFO queue to handle events
    while (this._eventQueue.length > 0) {
      const currentEvent = this._eventQueue.shift()!;

      const handlers = this._subscribers.get(currentEvent.type()) || [];
      for (const handler of handlers) {
        const result = handler.handle(currentEvent);

        // ถ้า handler สร้าง event ใหม่ -> ใส่ท้ายคิว
        if (result) {
          if (Array.isArray(result)) {
            this._eventQueue.push(...result);
          } else {
            this._eventQueue.push(result);
          }
        }
      }
    }

    this._isPublishing = false;
  }

  // add reference of handler to dictionary based on event type
  subscribe(type: string, handler: ISubscriber): void {
    if (!this._subscribers.has(type)) {
      this._subscribers.set(type, []);
    }
    this._subscribers.get(type)?.push(handler);
  }

  // remove reference of handler from dictionary based on event type
  unsubscribe(type: string, handler: ISubscriber): void {
    if (!this._subscribers.has(type)) {
      return;
    }
    const handlers = this._subscribers.get(type);
    this._subscribers.set(type, handlers?.filter((h) => h !== handler) || []);
  }
}

// implementations
class MachineSaleEvent implements IEvent {
  private readonly _sold: number;
  private readonly _machineId: string;
  constructor(sold: number, machineId: string) {
    this._sold = sold;
    this._machineId = machineId;
  }

  machineId(): string {
    return this._machineId;
  }

  getSoldQuantity(): number {
    return this._sold;
  }

  type(): string {
    return "sale";
  }
}

class MachineRefillEvent implements IEvent {
  private readonly _refill: number;
  private readonly _machineId: string;
  constructor(refill: number, machineId: string) {
    this._refill = refill;
    this._machineId = machineId;
  }

  machineId(): string {
    return this._machineId;
  }

  getRefillQuantity(): number {
    return this._refill;
  }

  type(): string {
    return "refill";
  }
}

class LowStockWarningEvent implements IEvent {
  private readonly _machineId: string;
  constructor(machineId: string) {
    this._machineId = machineId;
  }

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return "low_stock_warning";
  }
}

class StockLevelOkEvent implements IEvent {
  private readonly _machineId: string;
  constructor(machineId: string) {
    this._machineId = machineId;
  }

  machineId(): string {
    return this._machineId;
  }

  type(): string {
    return "stock_level_ok";
  }
}

class MachineSaleSubscriber implements ISubscriber {
  private machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  public getMachines(): Machine[] {
    return this.machines;
  }

  public addMachine(machine: Machine): void {
    this.machines.push(machine);
  }

  public removeMachine(machine: Machine): void {
    this.machines = this.machines.filter((m) => m.id !== machine.id);
  }

  handle(event: IEvent): void {
    const machineIndex = this.machines.findIndex(
      (m) => m.id === event.machineId()
    );
    if (machineIndex === -1) {
      return;
    }
    if (event instanceof MachineSaleEvent) {
      this.machines[machineIndex].stockLevel -= event.getSoldQuantity();
      console.log(
        `Machine ${event.machineId()} sold ${event.getSoldQuantity()} units`
      );
    }
  }
}

class MachineRefillSubscriber implements ISubscriber {
  private machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  public getMachines(): Machine[] {
    return this.machines;
  }

  public addMachine(machine: Machine): void {
    this.machines.push(machine);
  }

  public removeMachine(machine: Machine): void {
    this.machines = this.machines.filter((m) => m.id !== machine.id);
  }

  handle(event: IEvent): void {
    const machineIndex = this.machines.findIndex(
      (m) => m.id === event.machineId()
    );
    if (machineIndex === -1) {
      return;
    }
    if (event instanceof MachineRefillEvent) {
      this.machines[machineIndex].stockLevel += event.getRefillQuantity();
      console.log(
        `Machine ${event.machineId()} refilled ${event.getRefillQuantity()} units`
      );
    }
  }
}

class StockWarningSubscriber implements ISubscriber {
  private machines: Map<string, [Machine, boolean]>; // boolean indicates if warning has been sent

  constructor(machines: Machine[]) {
    this.machines = new Map(machines.map((m) => [m.id, [m, false]]));
  }

  public getMachines(): Machine[] {
    return Array.from(this.machines.values()).map(([m]) => m);
  }

  public addMachine(machine: Machine): void {
    this.machines.set(machine.id, [machine, false]);
  }

  public removeMachine(machine: Machine): void {
    this.machines.delete(machine.id);
  }

  handle(event: IEvent): IEvent | void {
    if (!this.machines.has(event.machineId())) return;
    const machine = this.machines.get(event.machineId())![0];
    if (machine.stockLevel < 3 && !this.machines.get(event.machineId())![1]) {
      this.machines.set(event.machineId(), [machine, true]);
      return new LowStockWarningEvent(machine.id);
      // pubSubService.publish(new LowStockWarningEvent(machine.id));
    }
    if (machine.stockLevel >= 3 && this.machines.get(event.machineId())![1]) {
      this.machines.set(event.machineId(), [machine, false]);
      return new StockLevelOkEvent(machine.id);
    }
  }
}

class StockLoggerSubscriber implements ISubscriber {
  private machines: Machine[];

  constructor(machines: Machine[]) {
    this.machines = machines;
  }

  public getMachines(): Machine[] {
    return this.machines;
  }

  public addMachine(machine: Machine): void {
    this.machines.push(machine);
  }

  public removeMachine(machine: Machine): void {
    this.machines = this.machines.filter((m) => m.id !== machine.id);
  }

  handle(event: IEvent): void {
    if (event instanceof LowStockWarningEvent) {
      console.log(
        `Logging: Low stock warning for machine ${event.machineId()} with ${
          this.machines.find((m) => m.id === event.machineId())?.stockLevel
        } units left`
      );
    } else if (event instanceof StockLevelOkEvent) {
      console.log(
        `Logging: Stock level OK for machine ${event.machineId()} with ${
          this.machines.find((m) => m.id === event.machineId())?.stockLevel
        } units left`
      );
    }
  }
}

// objects
class Machine {
  public stockLevel = 10;
  public id: string;

  constructor(id: string) {
    this.id = id;
  }
}

// helpers
const randomMachine = (): string => {
  const random = Math.random() * 3;
  if (random < 1) {
    return "001";
  } else if (random < 2) {
    return "002";
  }
  return "003";
};

const eventGenerator = (): IEvent => {
  const random = Math.random();
  if (random < 0.5) {
    const saleQty = Math.random() < 0.5 ? 1 : 2; // 1 or 2
    return new MachineSaleEvent(saleQty, randomMachine());
  }
  const refillQty = Math.random() < 0.5 ? 3 : 5; // 3 or 5
  return new MachineRefillEvent(refillQty, randomMachine());
};

// program
(async () => {
  // create 3 machines with a quantity of 10 stock
  const machines: Machine[] = [
    new Machine("001"),
    new Machine("002"),
    new Machine("003"),
  ];

  // create subscribers (shared machines)
  const saleSubscriber = new MachineSaleSubscriber(machines);
  const refillSubscriber = new MachineRefillSubscriber(machines);
  const stockWarningSubscriber = new StockWarningSubscriber(machines);
  const stockLoggerSubscriber = new StockLoggerSubscriber(machines);

  // create the PubSub service
  const pubSubService: IPublishSubscribeService = new PublishSubscribeService();

  // subscribe the sale subscriber to 'sale' events
  pubSubService.subscribe("sale", saleSubscriber);
  // subscribe the refill subscriber to 'refill' events
  pubSubService.subscribe("refill", refillSubscriber);

  // subscribe the stock warning subscriber to 'sale' and 'refill' events
  pubSubService.subscribe("sale", stockWarningSubscriber);
  pubSubService.subscribe("refill", stockWarningSubscriber);

  // subscribe the stock logger subscriber to 'low_stock_warning' and 'stock_level_ok' events
  pubSubService.subscribe("low_stock_warning", stockLoggerSubscriber);
  pubSubService.subscribe("stock_level_ok", stockLoggerSubscriber);

  console.log("\nInitial machine stocks:");
  machines.forEach((m) =>
    console.log(`Machine ${m.id} stock = ${m.stockLevel}`)
  );

  console.log(
    "\n========== TEST 1: CROSS BELOW 3 (LOW STOCK WARNING) =========="
  );
  // Make machine 001 drop from 10 -> 2 (crossing threshold)
  const eventsCrossLow: IEvent[] = [
    new MachineSaleEvent(4, "001"), // 10 -> 6
    new MachineSaleEvent(4, "001"), // 6 -> 2  (cross below 3) => should fire LowStockWarningEvent ONCE
    new MachineSaleEvent(1, "001"), // 2 -> 1  (still below 3) => should NOT fire again
  ];

  eventsCrossLow.forEach((e) => {
    console.log(`\nPublish: ${e.type()} machine=${e.machineId()}`);
    pubSubService.publish(e);
  });

  console.log("\nMachine stocks after TEST 1:");
  machines.forEach((m) =>
    console.log(`Machine ${m.id} stock = ${m.stockLevel}`)
  );

  console.log(
    "\n========== TEST 2: CROSS BACK TO >= 3 (STOCK LEVEL OK) =========="
  );
  // Refill machine 001 to cross back to >= 3
  const eventsCrossOk: IEvent[] = [
    new MachineRefillEvent(2, "001"), // 1 -> 3 (cross to ok) => should fire StockLevelOkEvent ONCE
    new MachineRefillEvent(5, "001"), // 3 -> 8 (still ok)   => should NOT fire again
  ];

  eventsCrossOk.forEach((e) => {
    console.log(`\nPublish: ${e.type()} machine=${e.machineId()}`);
    pubSubService.publish(e);
  });

  console.log("\nMachine stocks after TEST 2:");
  machines.forEach((m) =>
    console.log(`Machine ${m.id} stock = ${m.stockLevel}`)
  );

  console.log("\n========== TEST 3: RANDOM EVENTS ==========");
  // create 5 random events
  const events = [1, 2, 3, 4, 5].map((i) => eventGenerator());
  for (const e of events) {
    console.log(`event: ${e.type()} for machine ${e.machineId()}`);
  }

  // publish the events
  events.forEach((event) => {
    pubSubService.publish(event);
  });

  console.log("\nMachine stocks after TEST 3:");
  machines.forEach((m) =>
    console.log(`Machine ${m.id} stock = ${m.stockLevel}`)
  );

  // random unsubscribe one of the sales subscriber's machines
  const machineToUnsubscribe = randomMachine();
  const machineObj = machines.find((m) => m.id === machineToUnsubscribe);
  console.log(
    `\n========== TEST 4: REMOVING ${machineToUnsubscribe} FROM SALE SUBSCRIBER ==========\n`
  );
  saleSubscriber.removeMachine(machineObj!);

  // create 5 random events
  const afterMachineRemovedEvents = [1, 2, 3, 4, 5].map((i) =>
    eventGenerator()
  );

  for (const e of afterMachineRemovedEvents) {
    console.log(`event: ${e.type()} for machine ${e.machineId()}`);
  }

  // publish the events
  afterMachineRemovedEvents.forEach((event) => {
    pubSubService.publish(event);
  });

  console.log("\nMachine stocks after TEST 4:");
  machines.forEach((m) =>
    console.log(`Machine ${m.id} stock = ${m.stockLevel}`)
  );

  // unsubscribe the sale subscriber from 'sale' events
  pubSubService.unsubscribe("sale", saleSubscriber);

  // unsubscribe the sale subscriber from 'sale' events
  pubSubService.unsubscribe("sale", saleSubscriber);

  console.log(
    "\n========== TEST 5: PROVE SALE UNSUBSCRIBED (STOCK SHOULD NOT DECREASE) =========="
  );

  // pick a machine to test
  const testMachineId = "001";
  const beforeStock = machines.find((m) => m.id === testMachineId)!.stockLevel;

  console.log(`Before publishing sale event: Machine ${testMachineId} stock = ${beforeStock}`);

  // publish fixed sale events (should NOT change stock because saleSubscriber is unsubscribed)
  const fixedSaleEventsAfterUnsub: IEvent[] = [
    new MachineSaleEvent(2, testMachineId),
    new MachineSaleEvent(1, testMachineId),
  ];

  fixedSaleEventsAfterUnsub.forEach((e) => {
    console.log(`Publish: ${e.type()} machine=${e.machineId()}`);
    pubSubService.publish(e);
  });

  const afterStock = machines.find((m) => m.id === testMachineId)!.stockLevel;
  console.log(`After publishing sale events: Machine ${testMachineId} stock = ${afterStock}`);

  if (beforeStock === afterStock) {
    console.log("✅ PASS: Stock did NOT decrease after saleSubscriber unsubscribed.");
  } else {
    console.log("❌ FAIL: Stock changed even though saleSubscriber was unsubscribed.");
  }
})();
