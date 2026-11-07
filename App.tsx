import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, AppState, Linking, RefreshControl, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {articles, Article, Category, feed, formatPublicationDate} from './src/news';
import {filterNews, freshArticles, validateRemoteFeed, articleDate, rangeForPeriod, pacificToday, dateRangeError, Period, DateRange} from './src/news-filters';
import {theme as T} from './src/theme';

type Tab = 'News' | 'Search' | 'Tracked' | 'Account';
const categories: Category[] = ['All','Federal','GSEs','States'];
const tabIcons: Record<Tab,string> = {News:'⌂',Search:'⌕',Tracked:'▣',Account:'◉'};

function AppButton({title,onPress,secondary=false}:{title:string;onPress:()=>void;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.button,secondary?s.buttonAlt:null]}><Text style={[s.buttonText,secondary?s.buttonTextAlt:null]}>{title}</Text></Pressable>;
}
export default function App() {
  const [liveFeed,setLiveFeed] = useState({windowStart:feed.windowStart,windowEnd:feed.windowEnd,status:feed.status,articles:articles});
  const [refreshing,setRefreshing] = useState(false);
  const lastFetch = useRef(0);
  const activeRequest = useRef<AbortController|null>(null);
  const reloadFeed = useCallback(async()=>{
    activeRequest.current?.abort();
    const controller=new AbortController();activeRequest.current=controller;
    const timeout=setTimeout(()=>controller.abort(),12000);setRefreshing(true);
    try {
      const response=await fetch('https://raw.githubusercontent.com/jwilson2808-cmyk/regsradar-news/main/src/data/weekly-news.json',{signal:controller.signal});
      if(!response.ok)throw Error('Feed request failed');
      const updated=validateRemoteFeed(await response.json());
      if(!controller.signal.aborted){setLiveFeed(updated);lastFetch.current=Date.now();}
    } catch { /* Preserve the saved feed; stale articles are independently hidden. */ }
    finally {clearTimeout(timeout);if(activeRequest.current===controller)setRefreshing(false);}
  },[]);
  useEffect(()=>{
    void reloadFeed();
    const subscription=AppState.addEventListener('change',state=>{if(state==='active'&&Date.now()-lastFetch.current>3600000)void reloadFeed();});
    return ()=>{subscription.remove();activeRequest.current?.abort();};
  },[reloadFeed]);
  const [tab,setTab] = useState<Tab>('News');
  const [category,setCategory] = useState<Category>('All');
  const [query,setQuery] = useState('');
  const [selected,setSelected] = useState<Article|null>(null);
  const today = pacificToday();
  const [period,setPeriod] = useState<Period>('14');
  const [showTime,setShowTime] = useState(false);
  const [editCustom,setEditCustom] = useState(false);
  const [customRange,setCustomRange] = useState<DateRange>(rangeForPeriod('14',today));
  const [fromDate,setFromDate] = useState(customRange.from!);
  const [toDate,setToDate] = useState(customRange.to);
  const [dateError,setDateError] = useState<string|null>(null);
  const range = period==='custom'?customRange:rangeForPeriod(period,today);
  const periodLabels: Record<Period,string> = {'7':'Past 7 days','14':'Past 14 days',all:'All available',custom:'Custom dates'};
  const visible = useMemo(()=>filterNews(freshArticles(liveFeed.articles,today),{category,query,range}),[liveFeed.articles,category,query,range.from,range.to,today]);
  const applyDates = ()=>{
    const from=fromDate.trim(),to=toDate.trim();
    const error=dateRangeError(from,to,rangeForPeriod('14',today).from);
    if(error){setDateError(error);return;}
    setCustomRange({from,to});setPeriod('custom');setShowTime(false);setDateError(null);
  };
  const requireAccount = ()=>Alert.alert('Create a free account','Personalized alerts and tracking will require a RegsRadar account. Registration is not connected in this prototype.',[{text:'OK'}]);
  const openSource = (article: Article)=>Linking.openURL(article.sourceUrl).catch(()=>Alert.alert('Unable to open source','Please try again in your browser.'));
  const switchTab = (next:Tab)=>{setSelected(null);setTab(next);if(next==='News')setQuery('');};
  return <SafeAreaView style={s.root}><StatusBar barStyle="dark-content"/>
    <View style={s.header}>
      <View style={s.logoRow}><View><Text style={s.brand}>RegsRadar <Text style={s.brandLite}>News</Text></Text><Text style={s.brandCaption}>MORTGAGE REGULATORY NEWS</Text></View></View>
      <Pressable accessibilityLabel="Notification preferences" onPress={requireAccount} style={s.bell}><Text style={s.bellText}>Alerts</Text></Pressable>
    </View>
    {selected ? <ScrollView contentContainerStyle={s.content}>
      <Pressable onPress={()=>setSelected(null)}><Text style={s.back}>‹  Back to news</Text></Pressable>
      <Text style={s.sample}>{selected.sourceName} · {formatPublicationDate(selected.publishedDate)}</Text>
      <Text style={s.detailTitle}>{selected.title}</Text>
      <View style={s.metaRow}><Text style={s.agency}>{selected.agency}</Text><Text style={s.pill}>{selected.topic}</Text></View>
      <Text style={s.pill}>{selected.updateType}</Text>
      {selected.documentReference && <Text style={s.muted}>Reference: {selected.documentReference}</Text>}
      <Text style={s.sectionHeading}>Summary</Text><Text style={s.body}>{selected.summary}</Text>
      <Text style={s.sectionHeading}>What changed</Text><Text style={s.body}>{selected.whatChanged || selected.summary}</Text>
      <Text style={s.sectionHeading}>Why it matters</Text><Text style={s.body}>{selected.whyItMatters || selected.mortgageRelevance}</Text>
      <Text style={s.sectionHeading}>Affected area</Text><Text style={s.body}>{selected.affectedArea || selected.topic}</Text>
      {selected.effectiveDate && <><Text style={s.sectionHeading}>Effective date</Text><Text style={s.body}>{formatPublicationDate(selected.effectiveDate)}</Text></>}
      {selected.materialUpdateVerified && selected.materialUpdatedDate && <Text style={s.muted}>Material action: {formatPublicationDate(selected.materialUpdatedDate)}</Text>}
      <View style={{marginTop:20}}><AppButton title="Read official publication ↗" onPress={()=>openSource(selected)}/></View>
      <View style={s.notice}><Text style={s.noticeText}>Read the official publication to confirm applicability and effective dates. This summary is for information and is not legal advice.</Text></View>
      <AppButton title="Track in RegsRadar  →" onPress={requireAccount}/>
    </ScrollView> : <>
      {(tab==='News'||tab==='Search') ? <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>void reloadFeed()}/>}>
        {tab==='News' ? <View style={s.intro}><Text style={s.overline}>YOUR MORTGAGE REGULATORY WATCH</Text><Text style={s.hero}>Regulatory news,{'\n'}simplified.</Text><Text style={s.heroCaption}>Monitor mortgage regulatory developments and understand what matters to your organization.</Text></View> : <><Text style={s.pageTitle}>Search updates</Text><Text style={s.muted}>Find news by agency, topic, or keyword.</Text></>}
        <View style={s.searchWrap}><Text style={s.searchIcon}>⌕</Text><TextInput placeholder="Search regulatory news" placeholderTextColor={T.muted} value={query} onChangeText={setQuery} style={s.searchInput}/></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroller} contentContainerStyle={{gap:9}}>{categories.map(cat=><Pressable key={cat} onPress={()=>setCategory(cat)} style={[s.chip,category===cat?s.chipActive:null]}><Text style={[s.chipText,category===cat?s.chipTextActive:null]}>{cat}</Text></Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose time frame" accessibilityState={{expanded:showTime}} onPress={()=>{setShowTime(!showTime);setEditCustom(period==='custom');setDateError(null);}} style={s.timeButton}><Text style={s.timeLabel}>Time frame: {period==='custom'?`${formatPublicationDate(customRange.from!)} – ${formatPublicationDate(customRange.to)}`:periodLabels[period]} ▾</Text></Pressable>
        {showTime && <View style={s.timePanel}>
          <View style={s.timeOptions}>{(['7','14','all','custom'] as Period[]).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:period===value}} onPress={()=>{if(value==='custom'){setEditCustom(true);return;}setPeriod(value);setEditCustom(false);setShowTime(false);setDateError(null);}} style={[s.chip,period===value?s.chipActive:null]}><Text style={[s.chipText,period===value?s.chipTextActive:null]}>{periodLabels[value]}</Text></Pressable>)}</View>
          {editCustom && <View>
            <Text style={s.dateLabel}>Start date</Text><TextInput accessibilityLabel="Start date" placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} value={fromDate} onChangeText={value=>{setFromDate(value);setDateError(null);}} style={s.dateInput}/>
            <Text style={s.dateLabel}>End date</Text><TextInput accessibilityLabel="End date" placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} value={toDate} onChangeText={value=>{setToDate(value);setDateError(null);}} style={s.dateInput}/>
            {dateError && <Text accessibilityRole="alert" style={s.dateError}>{dateError}</Text>}
            <AppButton title="Apply dates" onPress={applyDates}/>
          </View>}
        </View>}
        <View style={s.feedHead}><Text style={s.pageTitle}>Regulatory updates</Text><Text style={s.count}>{visible.length} {visible.length===1?'article':'articles'}</Text></View>
        {visible.length===0?<Text style={s.empty}>{freshArticles(liveFeed.articles,today).length===0?'Regulatory updates are currently unavailable.':'No updates match your filters. Try a different time frame, category, or search.'}</Text>:visible.map(item=><Pressable key={item.id} onPress={()=>setSelected(item)} style={s.card}>
          <View style={s.cardTop}><Text style={s.agency}>{item.agency.toUpperCase()}</Text><Text style={s.sampleDate}>{item.materialUpdateVerified?'Updated ':''}{formatPublicationDate(articleDate(item))}</Text></View>
          <Text style={s.cardTitle}>{item.title}</Text><Text style={s.cardSummary} numberOfLines={3}>{item.summary}</Text>
          <View style={s.cardBottom}><Text style={s.topic}>{item.topic}</Text><Text style={s.readMore}>Read update  ›</Text></View>
        </Pressable>)}
      </ScrollView> : <ScrollView contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>{tab==='Tracked'?'Tracked articles':'Your account'}</Text>
        <View style={s.emptyCard}><Text style={s.emptyIcon}>{tab==='Tracked'?'▣':'◉'}</Text><Text style={s.emptyTitle}>{tab==='Tracked'?'Organize what matters':'Personalize your regulatory watch'}</Text><Text style={s.emptyDesc}>{tab==='Tracked'?'Registered users will be able to track articles into their RegsRadar workflow. Free accounts support up to five tracked news items.':'Create an account to select agencies and states, receive personalized notifications, and track regulatory developments.'}</Text><AppButton title="Account setup coming next" onPress={requireAccount}/></View>
        <Text style={s.footerNote}>The production RegsRadar account, subscription, and organization system has not been connected.</Text>
      </ScrollView>}
    </>}
    <View style={s.tabBar}>{(['News','Search','Tracked','Account'] as Tab[]).map(t=><Pressable key={t} accessibilityRole="tab" accessibilityState={{selected:tab===t}} onPress={()=>switchTab(t)} style={s.tab}><Text style={[s.tabIcon,tab===t?s.tabActive:null]}>{tabIcons[t]}</Text><Text style={[s.tabLabel,tab===t?s.tabActive:null]}>{t}</Text></Pressable>)}</View>
  </SafeAreaView>;
}
const s=StyleSheet.create({
  timeButton:{borderWidth:1,borderColor:T.border,borderRadius:6,backgroundColor:T.white,padding:12,marginBottom:16},timeLabel:{fontSize:12,fontWeight:'600',color:T.navy},timePanel:{padding:14,borderRadius:8,borderWidth:1,borderColor:T.border,backgroundColor:T.white,marginBottom:18},timeOptions:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},dateLabel:{fontSize:12,fontWeight:'600',color:T.ink,marginBottom:6},dateInput:{borderWidth:1,borderColor:T.border,borderRadius:6,padding:12,fontSize:14,color:T.ink,marginBottom:12},dateError:{fontSize:12,color:'#B42318',marginBottom:12},
  root:{flex:1,backgroundColor:T.white},header:{backgroundColor:T.white,borderBottomWidth:1,borderBottomColor:T.border,paddingHorizontal:22,paddingVertical:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logoRow:{flexDirection:'row',alignItems:'center',gap:10},brand:{fontSize:21,fontWeight:'700',color:T.navy,letterSpacing:-.5},brandLite:{fontWeight:'400'},brandCaption:{fontSize:9,color:T.muted,letterSpacing:1.4,marginTop:1},bell:{borderColor:T.border,borderWidth:1,borderRadius:6,paddingHorizontal:12,height:36,alignItems:'center',justifyContent:'center'},bellText:{fontSize:12,fontWeight:'600',color:T.navy},content:{padding:20,paddingBottom:30,backgroundColor:T.canvas,flexGrow:1},intro:{paddingHorizontal:4,paddingVertical:28,marginBottom:18,alignItems:'center'},overline:{fontSize:10,fontWeight:'600',letterSpacing:1.2,color:T.muted,textAlign:'center'},hero:{fontSize:33,fontWeight:'700',lineHeight:39,color:T.ink,letterSpacing:-1,marginTop:14,textAlign:'center'},heroCaption:{fontSize:15,lineHeight:24,color:T.muted,marginTop:18,textAlign:'center'},searchWrap:{flexDirection:'row',alignItems:'center',backgroundColor:T.white,borderWidth:1,borderColor:T.border,borderRadius:6,paddingHorizontal:15,height:48},searchIcon:{fontSize:27,color:T.blue,marginRight:8},searchInput:{flex:1,fontSize:14,color:T.ink},categoryScroller:{marginTop:16,marginBottom:21},chip:{backgroundColor:T.white,borderColor:T.border,borderWidth:1,borderRadius:6,paddingHorizontal:17,paddingVertical:10},chipActive:{backgroundColor:T.navy,borderColor:T.navy},chipText:{fontSize:12,fontWeight:'700',color:T.muted},chipTextActive:{color:T.white},feedHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11},pageTitle:{fontSize:21,fontWeight:'700',color:T.ink},muted:{fontSize:13,color:T.muted,marginTop:8,marginBottom:18},count:{fontSize:12,color:T.muted},demoBanner:{backgroundColor:'#FFF3D9',color:'#795218',fontSize:10,fontWeight:'800',letterSpacing:1,borderRadius:7,padding:9,overflow:'hidden',marginBottom:12},card:{backgroundColor:T.white,borderRadius:8,borderColor:T.border,borderWidth:1,padding:18,marginBottom:12},cardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:12},agency:{flexShrink:1,color:T.blue,fontSize:11,fontWeight:'800',letterSpacing:1},sampleDate:{flexShrink:0,fontSize:9,color:T.muted,fontWeight:'700'},cardTitle:{fontSize:17,fontWeight:'600',color:T.ink,lineHeight:23,marginTop:10},cardSummary:{fontSize:13,color:T.muted,lineHeight:20,marginTop:8},cardBottom:{borderTopColor:T.border,borderTopWidth:1,marginTop:15,paddingTop:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},topic:{fontSize:11,color:T.navy2,backgroundColor:T.paleBlue,overflow:'hidden',paddingHorizontal:10,paddingVertical:6,borderRadius:8},readMore:{fontSize:12,fontWeight:'800',color:T.blue},tabBar:{backgroundColor:T.white,borderTopColor:T.border,borderTopWidth:1,flexDirection:'row',paddingTop:10,paddingBottom:9},tab:{flex:1,alignItems:'center'},tabIcon:{fontSize:22,color:T.muted},tabLabel:{fontSize:10,color:T.muted,marginTop:3,fontWeight:'700'},tabActive:{color:T.blue},back:{fontSize:14,color:T.blue,fontWeight:'700',marginBottom:25},sample:{color:'#A77523',fontSize:10,fontWeight:'800',letterSpacing:1},detailTitle:{fontSize:28,fontWeight:'700',lineHeight:35,color:T.ink,marginVertical:15},metaRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10,marginBottom:15},pill:{fontSize:11,color:T.navy2,backgroundColor:T.paleBlue,padding:8,borderRadius:6,overflow:'hidden'},sectionHeading:{fontSize:16,fontWeight:'800',color:T.navy,marginTop:24,marginBottom:10},body:{fontSize:15,color:T.ink,lineHeight:24},notice:{backgroundColor:'#FFF3D9',borderRadius:12,padding:14,marginTop:26,marginBottom:20},noticeText:{fontSize:12,lineHeight:19,color:'#775419'},button:{backgroundColor:T.navy,borderRadius:6,padding:15,alignItems:'center'},buttonAlt:{backgroundColor:T.paleBlue},buttonText:{color:T.white,fontSize:14,fontWeight:'600'},buttonTextAlt:{color:T.navy},emptyCard:{marginTop:30,backgroundColor:T.white,borderWidth:1,borderColor:T.border,borderRadius:8,padding:25,alignItems:'center'},emptyIcon:{fontSize:36,color:T.blue,marginBottom:16},emptyTitle:{fontSize:18,fontWeight:'800',color:T.navy,textAlign:'center'},emptyDesc:{fontSize:13,color:T.muted,textAlign:'center',lineHeight:21,marginVertical:16},empty:{marginTop:20,color:T.muted,textAlign:'center'},footerNote:{fontSize:12,color:T.muted,lineHeight:18,marginTop:25,textAlign:'center'}
});
