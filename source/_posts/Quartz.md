---
title: Quartz
top_img: https://oss.passerjia.com/img/p1.jpg
cover: https://oss.passerjia.com/img/p1.jpg
categories: 定时任务
---
# Quartz的持久化存储

## 撰写背景

工作中遇到的需求，这里展示了两种方法，区别只在于配置文件的位置，其他步骤一致

## 建表

官方提供内置表：https://www.quartz-scheduler.org/downloads/

这里我选择的是2.3.0版，建表sql在
quartz-2.3.0-SNAPSHOT\src\org\quartz\impl\jdbcjobstore\tables_mysql.sql这个目录下

1. qrtz_blob_triggers : 以Blob 类型存储的触发器。
2. qrtz_calendars：存放日历信息， quartz可配置一个日历来指定一个时间范围。
3. qrtz_cron_triggers：存放cron类型的触发器。
4. qrtz_fired_triggers：存放已触发的触发器。
5. qrtz_job_details：存放一个jobDetail信息。
6. qrtz_locks： 存储程序的悲观锁的信息(假如使用了悲观锁)。
7. qrtz_paused_trigger_grps：存放暂停掉的触发器。
8. qrtz_scheduler_state：调度器状态。
9. qrtz_simple_triggers：简单触发器的信息。
10. qrtz_simprop_triggers：存储CalendarIntervalTrigger和DailyTimeIntervalTrigger两种类型的触发器。
11. qrtz_triggers：触发器的基本信息。

## 引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-quartz</artifactId>
</dependency>
```

## 方法一

### 加入properties配置文件

quartz.properties:

```properties
#=======================================================
#=======================================================
#用于设置Quartz调度器实例的唯一标识符，这里设置为自动生成
org.quartz.scheduler.instanceId=AUTO
#用于设置Quartz调度器实例的名称。
org.quartz.scheduler.instanceName=project1QuartzScheduler
org.quartz.scheduler.rmi.export=false
org.quartz.scheduler.rmi.proxy=false
#=======================================================
#=======================================================
#指定Quartz调度器使用的线程池类。
org.quartz.threadPool.class=org.quartz.simpl.SimpleThreadPool
#指定线程池中的线程数量。
org.quartz.threadPool.threadCount=5
#指定线程池中线程的优先级。
org.quartz.threadPool.threadPriority=5
org.quartz.threadPool.threadsInheritContextClassLoaderOfInitializingThread=true
#=======================================================
#=======================================================
#指定任务的错过阈值，即在任务被认为是错过之前的时间间隔。
org.quartz.jobStore.misfireThreshold=60000
#指定Quartz调度器使用的作业存储类。
org.quartz.jobStore.class=org.quartz.impl.jdbcjobstore.JobStoreTX
#指定数据库驱动委托类。
org.quartz.jobStore.driverDelegateClass=org.quartz.impl.jdbcjobstore.StdJDBCDelegate
#指定是否启用集群模式。
org.quartz.jobStore.isClustered=false
#指定作业存储表的前缀。
org.quartz.jobStore.tablePrefix=qrtz_
#指定作业存储使用的数据源。
org.quartz.jobStore.dataSource=myDS
#=======================================================
#=======================================================
#指定数据源使用的数据库驱动。
org.quartz.dataSource.myDS.driver= com.mysql.cj.jdbc.Driver
#数据库地址
org.quartz.dataSource.myDS.URL=               
#数据库账号
org.quartz.dataSource.myDS.user=              
#数据库密码
org.quartz.dataSource.myDS.password=       
#指定数据源的最大连接数。
org.quartz.dataSource.myDS.maxConnections= 5
#确保每次从连接池中取出连接时都会进行验证
org.quartz.dataSource.myDS.validateOnCheckout=true
org.quartz.dataSource.myDS.validationQuery=SELECT 'x'
```

### 增加配置类

为了扫描到Quartz的配置文件并将Quartz注入到SpringBoot中

```java
@Configuration
@Slf4j
public class QuartzConfig {
    @Autowired
    private JobFactory jobFactory;

    @Autowired
    private AutowireCapableBeanFactory capableBeanFactory;

    /**
     * 当触发器触发时，与之关联的任务被Scheduler中配置的JobFactory实例化，也就是每触发一次，就会创建一个任务的实例化对象
     * (如果缺省)则调用Job类的newInstance方法生成一个实例
     * (这里选择自定义)并将创建的Job实例化交给IoC管理
     *
     * @return
     */
    @Bean
    public JobFactory jobFactory() {
        return new AdaptableJobFactory() {
            @Override
            protected Object createJobInstance(TriggerFiredBundle bundle) throws Exception {
                Object jobInstance = super.createJobInstance(bundle);
                capableBeanFactory.autowireBean(jobInstance);
                return jobInstance;
            }
        };
    }

    @Bean
    public SchedulerFactoryBean schedulerFactoryBean() {
        SchedulerFactoryBean schedulerFactoryBean = new SchedulerFactoryBean();
        schedulerFactoryBean.setJobFactory(jobFactory);
        //延迟启动
        schedulerFactoryBean.setStartupDelay(1);
        //配置文件获取到
        Properties properties = getProperties("quartz.properties");
        schedulerFactoryBean.setQuartzProperties(properties);
        return schedulerFactoryBean;
    }

    //获取指定目录下的指定properties配置文件
    public static Properties getProperties(String fileName) {
        Properties properties = new Properties();
        try {
            String outpath = System.getProperty("user.dir") + File.separator + "config" + File.separator;//先读取config目录的，没有再加载classpath的（部署服务的时候将config文件夹放到项目主目录下，并将propertis配置文件放置config文件夹里）
            System.out.println(outpath);
            InputStream in = Files.newInputStream(new File(outpath + fileName).toPath());
            properties.load(in);
        } catch (IOException e) {
            log.info("获取quartz配置异常：{}",e.getMessage(),e);
        }
        return properties;
    }

    @Bean
    public Scheduler scheduler() {
        return schedulerFactoryBean().getScheduler();
    }
}
```

## 方法二（要求SpringBoot2.0版本及以后）

SpringBoot2.0版本及以后的版本集成了Quartz，无需再手动编写properties文件和配置类了，与方法一的区别仅仅只有这个。

### yml里集成Quartz配置文件

```yaml
spring:
  quartz:
    job-store-type: jdbc
    jdbc:
      initialize-schema: always
    properties:
      org.quartz.scheduler.instanceId: AUTO
      org.quartz.scheduler.instanceName: projectQuartzScheduler1
      org.quartz.threadPool.class: org.quartz.simpl.SimpleThreadPool
      org.quartz.threadPool.threadCount: 10
      org.quartz.threadPool.threadPriority: 5
      org.quartz.threadPool.threadsInheritContextClassLoaderOfInitializingThread: true
      org.quartz.jobStore.class: org.quartz.impl.jdbcjobstore.JobStoreTX
      org.quartz.jobStore.driverDelegateClass: org.quartz.impl.jdbcjobstore.StdJDBCDelegate
      org.quartz.jobStore.tablePrefix: qrtz_
      org.quartz.jobStore.isClustered: true
      org.quartz.jobStore.dataSource: myDS
      org.quartz.jobStore.misfireThreshold: 60000
      org.quartz.dataSource.myDS.driver: com.mysql.cj.jdbc.Driver
      org.quartz.dataSource.myDS.URL: 
      org.quartz.dataSource.myDS.user: 
      org.quartz.dataSource.myDS.password: 
      org.quartz.scheduler.rmi.export: false
      org.quartz.scheduler.rmi.proxy: false
```

## 编写调用类

需求业务编写的地方

```java
@Slf4j
public class SendOrder extends QuartzJobBean {
    @Override
    protected void executeInternal(JobExecutionContext jobExecutionContext) throws JobExecutionException {
        System.out.println("abc");
    }
```

## 新增和修改Job

注：PageData类似Map<String,Object>

```java
@Slf4j
@Component
public class QuartzJob {

    @Autowired
    private Scheduler scheduler;

    SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd");

    //对外方法，负责启动调度器
    public void start() throws Exception {
        scheduler.start();
    }

    public void createJob(PageData pd) throws Exception {
        Class<org.quartz.Job> clazz;
        try {
            //这就是调度器要执行的类
            clazz = (Class<org.quartz.Job>) Class.forName("你需要执行类的类路径");
        } catch (ClassNotFoundException e1) {
            throw new RuntimeException(e1);
        }
        //创建任务Job
        JobDetail jobDetail = JobBuilder.newJob(clazz)
                .usingJobData("planId", String.valueOf(pd.get("planId")))//给任务Job传入参数，调用类中可以获取到
                .withIdentity(String.valueOf(pd.get("planId")))//给任务Job起名字
                .build();
        //获取当前Cron时间
        String cron = String.valueOf(pd.get("cronName"));
        //创建表达式，构建触发器Trigger
        CronScheduleBuilder cronScheduleBuilder = CronScheduleBuilder.cronSchedule(cron).withMisfireHandlingInstructionDoNothing();
        //创建触发器Trigger
        CronTrigger cronTrigger = TriggerBuilder.newTrigger()
                .forJob(jobDetail)
                .withSchedule(cronScheduleBuilder)
                .withIdentity(String.valueOf(pd.get("planId")))//给触发器Trigger起名字
                .startAt(dateFormat.parse(String.valueOf(pd.get("planStartDate"))))  // 设置起始时间
                .endAt(dateFormat.parse(String.valueOf(pd.get("planEndDate")))) // 设置结束时间
                .build();
        //调度器整合任务与对应的触发器
        scheduler.scheduleJob(jobDetail, cronTrigger);
        log.info("当前job创建成功：{}", pd.get("planId"));
    }

    /**
     * 1.此方法会对触发器进行更新，主要更新Cron表达式
     * 2.此方法会判定当前触发器的时间较上一分钟是否存在修改
     * 3.只有判定存在修改时，才会对表达式进行修改
     */
    public void updateJob(PageData pd) throws Exception {

        //创建一个要修改的触发器的资料，身份
        TriggerKey triggerKey = new TriggerKey(String.valueOf(pd.get("planId")));

        //获取要更改的具体的CronTrigger触发器
        CronTrigger cronTrigger = (CronTrigger) scheduler.getTrigger(triggerKey);

        //如果没有触发器，则重新新增job和触发器
        if(cronTrigger==null){
            createJob(pd);
        }else{
            //获取当前cron表达式
            String oldTime = cronTrigger.getCronExpression();
            if (!oldTime.equals(String.valueOf(pd.get("cronName")))) {
                //用修改后的时间更新触发器
                CronScheduleBuilder cronScheduleBuilder = CronScheduleBuilder.cronSchedule(String.valueOf(pd.get("cronName"))).withMisfireHandlingInstructionDoNothing();
                CronTrigger cronTrigger1 = TriggerBuilder.newTrigger()
                        .withIdentity(String.valueOf(pd.get("planId")))
                        .withSchedule(cronScheduleBuilder)
                        .startAt(dateFormat.parse(String.valueOf(pd.get("planStartDate"))))  // 设置起始时间
                        .endAt(dateFormat.parse(String.valueOf(pd.get("planEndDate")))) // 设置结束时间
                        .build();
                //调度器整合新的触发器
                scheduler.rescheduleJob(triggerKey, cronTrigger1);
                log.info("监听到修改，任务“{}”发生修改，修改前cron表达式为：{} ，修改后cron表达式为： {}", pd.get("planId"), oldTime, pd.get("cronName"));
            }
        }
    }
}
```

## 调度器的初始化

```java
@Slf4j
@Component
@Order(5)
public class QuartzStart implements CommandLineRunner {

    @Autowired
    QuartzJob quartzJob;

    @Override
    public void run(String... args) throws Exception {
        //定时任务启动
        //全部任务都开始执行
        try {
            quartzJob.start();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        System.out.println("==============调度任务已经启动==========");
    }
}
```

## 扩展

```java
@Slf4j
@Component
public class JobControl {
    @Autowired
    Scheduler scheduler;

    /**
     * 新增一个定时任务
     * @param jName 任务名称
     * @param jGroup 任务组
     * @param tName 触发器名称
     * @param tGroup 触发器组
     * @param cron cron表达式
     */
    public void addJob(Class <? extends Job> jobClass,String jName, String jGroup, String tName, String tGroup, String cron) {
        try {
            JobDetail jobDetail = JobBuilder.newJob(jobClass)
                    .withIdentity(jName, jGroup)
                    .build();
            CronTrigger trigger = TriggerBuilder.newTrigger()
                    .withIdentity(tName, tGroup)
                    .startNow()
                    .withSchedule(CronScheduleBuilder.cronSchedule(cron))
                    .build();
            scheduler.start();
            scheduler.scheduleJob(jobDetail, trigger);
        } catch (Exception e) {
            e.printStackTrace();
        }

    }

    /**
     * 暂停定时任务
     * @param jName 任务名
     * @param jGroup 任务组
     */
    public void pauseJob(String jName, String jGroup) {
        try {
            scheduler.pauseJob(JobKey.jobKey(jName, jGroup));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 继续定时任务
     * @param jName 任务名
     * @param jGroup 任务组
     */
    public void resumeJob(String jName, String jGroup) {
        try {
            scheduler.resumeJob(JobKey.jobKey(jName, jGroup));
        } catch (SchedulerException e) {
            e.printStackTrace();
        }
    }

    /**
     * 删除定时任务
     * @param jName 任务名
     * @param jGroup 任务组
     */
    public void deleteJob(String jName, String jGroup) {
        try {
            scheduler.deleteJob(JobKey.jobKey(jName, jGroup));
        } catch (SchedulerException e) {
            e.printStackTrace();
        }
    }
}
```

