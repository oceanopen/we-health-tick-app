/**
 * lib.rs — 库文件（Library Crate）
 *
 * 【什么是 lib.rs？】
 * 在 Rust 项目中，lib.rs 是"库 crate"的入口文件（类似于 Java 中的主类）。
 * 与 main.rs 不同，lib.rs 不能直接运行，而是被其他代码引用（import）。
 * Tauri v2 推荐：把应用逻辑放在 lib.rs，main.rs 只做启动调用。
 *
 * 【为什么 Tauri 用 lib.rs 而不是全写在 main.rs？】
 * 因为移动端（iOS/Android）不能从 main.rs 启动，它们有自己的入口方式。
 * 把逻辑放在 lib.rs 中，移动端和桌面端都能共享同一份代码。
 *
 * 【Rust 语法知识要点】
 * #[...]        → 属性（attribute），给编译器添加额外指令
 * pub fn        → 公开函数，其他文件/模块可以调用
 * ::default()   → 调用类型的默认构造方法（建造者模式）
 * |param| {...} → 闭包（closure），类似 JS 的箭头函数 (param) => { ... }
 * ? 操作符      → 错误传播，如果出错就提前返回错误，否则继续执行
 * ! 后缀宏      → 感叹号结尾的是"宏"（macro），如 cfg!()、tauri::generate_context!()
 * Ok(())        → Rust 中表示"成功，没有返回值"的标准写法
 */

/**
 * #[cfg_attr(mobile, tauri::mobile_entry_point)]
 *
 * 条件属性，用于移动端支持。
 *
 * 逐层拆解：
 *   cfg_attr(条件, 属性) → 条件编译属性
 *
 *   mobile → Rust 的目标平台配置标志
 *     编译目标为 iOS 或 Android 时，mobile = true
 *     编译目标为 macOS/Windows/Linux 时，mobile = false
 *
 *   tauri::mobile_entry_point → Tauri 提供的属性宏
 *     它会为移动平台生成必要的入口代码（比如 iOS 的 UIApplicationMain 调用）
 *
 * 综合效果：
 *   编译 iOS/Android 时 → 自动添加移动端入口点代码
 *   编译桌面端时       → 这行属性被忽略，不影响正常使用
 */
#[cfg_attr(mobile, tauri::mobile_entry_point)]

/**
 * pub fn run()
 *
 * `pub` 表示这个函数是公开的，其他 crate（比如 main.rs）可以调用它。
 * 如果不加 `pub`，函数默认是私有的，只能在当前文件内使用。
 *
 * 返回类型：没有写 `-> 某个类型`，说明返回 unit 类型 `()`（类似于 C 的 void）
 * 实际上函数最后执行 `.expect(...)` 时如果成功返回 `()`，如果失败会 panic（崩溃）
 */
pub fn run() {
  /**
   * tauri::Builder::default()
   *
   * 【建造者模式（Builder Pattern）】
   * Tauri 使用建造者模式来创建应用。步骤是：
   *   1. Builder::default()  → 创建一个默认的构建器
   *   2. .setup(...)         → 配置初始化逻辑
   *   3. .run(...)           → 启动应用
   *
   * 这和 JavaScript 中的链式调用很像：new App().use(plugin).listen(3000)
   *
   * 【Rust 语法】
   *   tauri::Builder → tauri 包中的 Builder 结构体（struct）
   *   ::default()    → 调用 Builder 的 default() 关联函数（类似静态方法）
   *                     这是 Rust 的 Default trait 提供的方法
   *                     trait 类似其他语言的 interface（接口）
   */
  tauri::Builder::default()

    /**
     * .setup(|app| { ... })
     *
     * 【setup 方法】
     * 在 Tauri 应用启动后、窗口创建前执行的初始化回调。
     * 适合做一次性设置，比如初始化日志、注册命令、加载配置等。
     *
     * 【闭包语法 |app| { ... }】
     * 这是 Rust 的闭包（closure），等价于其他语言的匿名函数/lambda：
     *   JavaScript:  (app) => { ... }
     *   Python:      lambda app: ...
     *   Java:        app -> { ... }
     *
     * `app` 参数的类型是 `&mut App`（App 的可变引用），由 Tauri 自动推断。
     *   &   → 表示引用（borrow），不获取所有权，用完归还
     *   mut → 表示可变（mutable），允许修改 app 的状态
     *
     * setup 返回 Result 类型，所以闭包里需要返回 Ok(()) 或 Err(...)
     */
    .setup(|app| {

      /**
       * cfg!(debug_assertions)
       *
       * `cfg!()` 是一个 **宏**（注意感叹号），在编译时求值，返回 true/false。
       *   debug 模式（cargo build）            → true
       *   release 模式（cargo build --release） → false
       *
       * 这和文件顶部 #[cfg_attr(not(debug_assertions), ...)] 用的是同一个标志。
       * 区别是：#[] 属性在编译时决定代码是否存在，cfg!() 在运行时返回布尔值。
       *
       * 为什么要判断？因为日志插件只在开发时有用，发布给用户时不需要。
       */
      if cfg!(debug_assertions) {

        /**
         * app.handle()
         *
         * 获取 App 的句柄（handle）。句柄是对 App 的一个"弱引用"，
         * 可以在 App 生命周期的任何地方使用，不需要持有 App 的所有权。
         *
         * 为什么要用 handle 而不直接用 app？
         *   因为 setup 回调结束后 app 会被 Tauri 框架接管，
         *   后续需要通过 handle 来访问应用状态。
         */

        /**
         * .plugin(...)
         *
         * 向 Tauri 应用注册一个插件。
         * Tauri 的插件系统允许扩展应用功能，比如日志、通知、文件系统访问等。
         * 每个插件都是一个实现了 Plugin trait 的结构体。
         */

        /**
         * tauri_plugin_log::Builder::default()
         *
         * 日志插件的建造者，用于配置日志行为。
         * 同样使用建造者模式：创建 → 配置 → 构建
         */

        /**
         * .level(log::LevelFilter::Info)
         *
         * 设置日志级别为 Info。日志级别从低到高：
         *   Trace（最详细）→ Debug → Info → Warn → Error → Off（关闭）
         *
         * 设置为 Info 表示：Trace 和 Debug 级别的日志会被过滤掉，
         * 只显示 Info、Warn、Error 级别的日志。
         *
         * `log` crate 是 Rust 的事实标准日志接口，
         * `LevelFilter` 是它定义的日志级别枚举（enum）。
         */

        /**
         * .build()
         *
         * 构建日志插件实例，返回一个实现了 Plugin trait 的对象。
         */
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;

        /**
         * `?` 操作符
         *
         * Rust 的错误传播操作符。它的含义是：
         *   如果结果是 Ok → 取出 Ok 里的值，继续执行
         *   如果结果是 Err → 立即从当前函数返回这个错误
         *
         * 等价于：
         *   match result {
         *     Ok(value) => value,
         *     Err(e) => return Err(e),
         *   }
         *
         * 因为 setup 闭包要求返回 Result<(), Box<dyn Error>>，
         * 所以用 `?` 可以把 plugin 注册的潜在错误向上传播。
         */
      }

      /**
       * Ok(())
       *
       * Rust 中表示"操作成功，没有返回值"的标准方式。
       *   Ok   → Result 枚举的变体，表示成功
       *   ()   → unit 类型，Rust 中的"空"类型，类似 void
       *
       * setup 闭包的返回类型必须是 Result，所以成功时返回 Ok(())。
       * 如果初始化失败，可以返回 Err(某个错误)。
       */
      Ok(())
    })

    /**
     * .run(tauri::generate_context!())
     *
     * 【run 方法】
     * 启动 Tauri 应用！这一步会：
     *   1. 创建应用窗口
     *   2. 加载前端页面（HTML/CSS/JS）
     *   3. 启动事件循环（event loop），开始接收用户交互
     *
     * 【tauri::generate_context!() 宏】
     * 这是一个 **过程宏**（procedural macro），在编译时展开。
     * 它做的事情：
     *   1. 读取 tauri.conf.json 配置
     *   2. 找到前端的构建产物（dist/ 目录下的文件）
     *   3. 生成 Rust 代码，把前端资源嵌入到最终的可执行文件中
     *
     * 这样你的应用就是一个单独的 .exe / .app 文件，不需要额外的前端文件。
     *
     * 感叹号 `!` 表示这是一个宏调用，不是普通函数。
     * 宏和函数的区别：宏在编译时展开代码，函数在运行时调用。
     */
    .run(tauri::generate_context!())

    /**
     * .expect("error while running tauri application")
     *
     * 【expect 方法】
     * 处理 run() 的返回值。run() 返回 Result 类型：
     *   Ok(()) → 应用正常运行并退出，expect 直接返回 ()
     *   Err(e) → 应用启动失败，expect 会 **panic**（程序崩溃），
     *            并打印 "error while running tauri application" 和错误详情
     *
     * 【expect vs unwrap】
     *   .unwrap()    → 失败时 panic，但错误信息不明确
     *   .expect("…") → 失败时 panic，附带自定义错误信息（推荐使用）
     *
     * 对于应用启动这种关键步骤，直接 panic 是合理的——如果连应用都启动不了，
     * 继续运行也没有意义。但对于可恢复的错误，应该用 `?` 传播而不是 panic。
     */
    .expect("error while running tauri application");
}
