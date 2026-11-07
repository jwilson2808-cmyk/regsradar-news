import React, {useMemo, useState} from 'react';
import {Alert, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View} from 'react-native';
import {articles, Article, Category} from './src/news';
import {theme as T} from './src/theme';

type Tab = 'News' | 'Search' | 'Tracked' | 'Account';
const categories: Category[] = ['All','Federal','GSEs','States'];
const tabIcons: Record<Tab,string> = {News:'⌂',Search:'⌕',Tracked:'▣',Account:'◉'};

function AppButton({title,onPress,secondary=false}:{title:string;onPress:()=>void;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={[s.button,secondary?s.buttonAlt:null]}><Text style={[s.buttonText,secondary?s.buttonTextAlt:null]}>{title}</Text></Pressable>;
}
export default function App() {
  const [tab,setTab] = useState<Tab>('News');
  const [category,setCategory] = useState<Category>('All');
  const [query,setQuery] = useState('');
  const [selected,setSelected] = useState<Article|null>(null);
  const visible = useMemo(()=>articles.filter(a=>(category==='All'||a.category===category)&&`${a.title} ${a.summary} ${a.agency} ${a.topic}`.toLowerCase().includes(query.toLowerCase())),[category,query]);
  const requireAccount = ()=>Alert.alert('Create a free account','Personalized alerts and tracking will require a RegsRadar account. Registration is not connected in this prototype.',[{text:'OK'}]);
  const switchTab = (next:Tab)=>{setSelected(null);setTab(next);if(next==='News')setQuery('');};
  return <SafeAreaView style={s.root}><StatusBar barStyle="dark-content"/>
    <View style={s.header}>
      <View style={s.logoRow}><View><Text style={s.brand}>RegsRadar <Text style={s.brandLite}>News</Text></Text><Text style={s.brandCaption}>MORTGAGE REGULATORY NEWS</Text></View></View>
      <Pressable accessibilityLabel="Notification preferences" onPress={requireAccount} style={s.bell}><Text style={s.bellText}>Alerts</Text></Pressable>
    </View>
    {selected ? <ScrollView contentContainerStyle={s.content}>
      <Pressable onPress={()=>setSelected(null)}><Text style={s.back}>‹  Back to news</Text></Pressable>
      <Text style={s.sample}>DEMONSTRATION ARTICLE · NOT LIVE NEWS</Text>
      <Text style={s.detailTitle}>{selected.title}</Text>
      <View style={s.metaRow}><Text style={s.agency}>{selected.agency}</Text><Text style={s.pill}>{selected.topic}</Text></View>
      <Text style={s.sectionHeading}>Overview</Text><Text style={s.body}>{selected.summary}</Text>
      <Text style={s.sectionHeading}>Potential compliance consideration</Text><Text style={s.body}>{selected.impact}</Text>
      <View style={s.notice}><Text style={s.noticeText}>This prototype does not contain verified source publications. Direct official-source links will be added only after the news API is validated.</Text></View>
      <AppButton title="Track in RegsRadar  →" onPress={requireAccount}/>
    </ScrollView> : <>
      {(tab==='News'||tab==='Search') ? <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {tab==='News' ? <View style={s.intro}><Text style={s.overline}>YOUR MORTGAGE REGULATORY WATCH</Text><Text style={s.hero}>Regulatory news,{'\n'}simplified.</Text><Text style={s.heroCaption}>Monitor mortgage regulatory developments and understand what matters to your organization.</Text></View> : <><Text style={s.pageTitle}>Search updates</Text><Text style={s.muted}>Find news by agency, topic, or keyword.</Text></>}
        <View style={s.searchWrap}><Text style={s.searchIcon}>⌕</Text><TextInput placeholder="Search regulatory news" placeholderTextColor={T.muted} value={query} onChangeText={setQuery} style={s.searchInput}/></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroller} contentContainerStyle={{gap:9}}>{categories.map(cat=><Pressable key={cat} onPress={()=>setCategory(cat)} style={[s.chip,category===cat?s.chipActive:null]}><Text style={[s.chipText,category===cat?s.chipTextActive:null]}>{cat}</Text></Pressable>)}</ScrollView>
        <View style={s.feedHead}><Text style={s.pageTitle}>Latest updates</Text><Text style={s.count}>{visible.length} samples</Text></View>
        <Text style={s.demoBanner}>PROTOTYPE — SAMPLE CONTENT ONLY</Text>
        {visible.length===0?<Text style={s.empty}>No sample articles match your search.</Text>:visible.map(item=><Pressable key={item.id} onPress={()=>setSelected(item)} style={s.card}>
          <View style={s.cardTop}><Text style={s.agency}>{item.agency.toUpperCase()}</Text><Text style={s.sampleDate}>{item.publishedLabel}</Text></View>
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
  root:{flex:1,backgroundColor:T.white},header:{backgroundColor:T.white,borderBottomWidth:1,borderBottomColor:T.border,paddingHorizontal:22,paddingVertical:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},logoRow:{flexDirection:'row',alignItems:'center',gap:10},brand:{fontSize:21,fontWeight:'700',color:T.navy,letterSpacing:-.5},brandLite:{fontWeight:'400'},brandCaption:{fontSize:9,color:T.muted,letterSpacing:1.4,marginTop:1},bell:{borderColor:T.border,borderWidth:1,borderRadius:6,paddingHorizontal:12,height:36,alignItems:'center',justifyContent:'center'},bellText:{fontSize:12,fontWeight:'600',color:T.navy},content:{padding:20,paddingBottom:30,backgroundColor:T.canvas,flexGrow:1},intro:{paddingHorizontal:4,paddingVertical:28,marginBottom:18,alignItems:'center'},overline:{fontSize:10,fontWeight:'600',letterSpacing:1.2,color:T.muted,textAlign:'center'},hero:{fontSize:33,fontWeight:'700',lineHeight:39,color:T.ink,letterSpacing:-1,marginTop:14,textAlign:'center'},heroCaption:{fontSize:15,lineHeight:24,color:T.muted,marginTop:18,textAlign:'center'},searchWrap:{flexDirection:'row',alignItems:'center',backgroundColor:T.white,borderWidth:1,borderColor:T.border,borderRadius:6,paddingHorizontal:15,height:48},searchIcon:{fontSize:27,color:T.blue,marginRight:8},searchInput:{flex:1,fontSize:14,color:T.ink},categoryScroller:{marginTop:16,marginBottom:21},chip:{backgroundColor:T.white,borderColor:T.border,borderWidth:1,borderRadius:6,paddingHorizontal:17,paddingVertical:10},chipActive:{backgroundColor:T.navy,borderColor:T.navy},chipText:{fontSize:12,fontWeight:'700',color:T.muted},chipTextActive:{color:T.white},feedHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:11},pageTitle:{fontSize:21,fontWeight:'700',color:T.ink},muted:{fontSize:13,color:T.muted,marginTop:8,marginBottom:18},count:{fontSize:12,color:T.muted},demoBanner:{backgroundColor:'#FFF3D9',color:'#795218',fontSize:10,fontWeight:'800',letterSpacing:1,borderRadius:7,padding:9,overflow:'hidden',marginBottom:12},card:{backgroundColor:T.white,borderRadius:8,borderColor:T.border,borderWidth:1,padding:18,marginBottom:12},cardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},agency:{color:T.blue,fontSize:11,fontWeight:'800',letterSpacing:1},sampleDate:{fontSize:9,color:T.muted,fontWeight:'700'},cardTitle:{fontSize:17,fontWeight:'600',color:T.ink,lineHeight:23,marginTop:10},cardSummary:{fontSize:13,color:T.muted,lineHeight:20,marginTop:8},cardBottom:{borderTopColor:T.border,borderTopWidth:1,marginTop:15,paddingTop:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},topic:{fontSize:11,color:T.navy2,backgroundColor:T.paleBlue,overflow:'hidden',paddingHorizontal:10,paddingVertical:6,borderRadius:8},readMore:{fontSize:12,fontWeight:'800',color:T.blue},tabBar:{backgroundColor:T.white,borderTopColor:T.border,borderTopWidth:1,flexDirection:'row',paddingTop:10,paddingBottom:9},tab:{flex:1,alignItems:'center'},tabIcon:{fontSize:22,color:T.muted},tabLabel:{fontSize:10,color:T.muted,marginTop:3,fontWeight:'700'},tabActive:{color:T.blue},back:{fontSize:14,color:T.blue,fontWeight:'700',marginBottom:25},sample:{color:'#A77523',fontSize:10,fontWeight:'800',letterSpacing:1},detailTitle:{fontSize:28,fontWeight:'700',lineHeight:35,color:T.ink,marginVertical:15},metaRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:15},pill:{fontSize:11,color:T.navy2,backgroundColor:T.paleBlue,padding:8,borderRadius:6,overflow:'hidden'},sectionHeading:{fontSize:16,fontWeight:'800',color:T.navy,marginTop:24,marginBottom:10},body:{fontSize:15,color:T.ink,lineHeight:24},notice:{backgroundColor:'#FFF3D9',borderRadius:12,padding:14,marginTop:26,marginBottom:20},noticeText:{fontSize:12,lineHeight:19,color:'#775419'},button:{backgroundColor:T.navy,borderRadius:6,padding:15,alignItems:'center'},buttonAlt:{backgroundColor:T.paleBlue},buttonText:{color:T.white,fontSize:14,fontWeight:'600'},buttonTextAlt:{color:T.navy},emptyCard:{marginTop:30,backgroundColor:T.white,borderWidth:1,borderColor:T.border,borderRadius:8,padding:25,alignItems:'center'},emptyIcon:{fontSize:36,color:T.blue,marginBottom:16},emptyTitle:{fontSize:18,fontWeight:'800',color:T.navy,textAlign:'center'},emptyDesc:{fontSize:13,color:T.muted,textAlign:'center',lineHeight:21,marginVertical:16},empty:{marginTop:20,color:T.muted,textAlign:'center'},footerNote:{fontSize:12,color:T.muted,lineHeight:18,marginTop:25,textAlign:'center'}
});
